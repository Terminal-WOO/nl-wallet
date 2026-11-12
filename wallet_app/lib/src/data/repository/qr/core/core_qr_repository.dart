import 'dart:convert';

import 'package:fimber/fimber.dart';
import 'package:http/http.dart' as http;
import 'package:meta/meta.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:wallet_core/core.dart';

import '../../../../../environment.dart';
import '../../../../domain/model/navigation/navigation_request.dart';
import '../../../../domain/model/qr/edi_qr_code.dart';
import '../../../../wallet_core/typed/typed_wallet_core.dart';
import '../qr_repository.dart';

class CoreQrRepository implements QrRepository {
  final TypedWalletCore _walletCore;

  CoreQrRepository(this._walletCore);

  @override
  Future<NavigationRequest> processBarcode(Barcode barcode) {
    final legacyValue = legacyQrToDeeplink(barcode);
    return _processRawValue(legacyValue ?? barcode.rawValue!);
  }

  /// Attempt to convert a legacy style json encoded scenario to a deeplink url that we can process normally.
  /// Sample input: {"id":"DRIVING_LICENSE","type":"issue"}
  /// Returns null if the conversion failed or was intentionally not attempted (on non-mock builds).
  @visibleForTesting
  String? legacyQrToDeeplink(Barcode barcode, {bool forceConversion = false}) {
    if (!Environment.mockRepositories && !forceConversion) return null;
    try {
      EdiQrCode.fromJson(jsonDecode(barcode.rawValue!));
      // No exception, so create the deeplink uri that we can process normally
      final String url = 'walletdebuginteraction://deeplink#${barcode.rawValue}';
      return Uri.parse(url).toString(); // uri encode the content
    } catch (ex) {
      Fimber.e('Failed to extract process as EdiQrCode. Contents: ${barcode.rawValue}');
    }
    return null;
  }

  Future<NavigationRequest> _processRawValue(String rawValue) async {
    // Check if this is a custom disclosure request via deeplink format
    if (rawValue.startsWith('walletdebuginteraction://deeplink#')) {
      try {
        final uri = Uri.parse(rawValue);
        final fragment = Uri.decodeComponent(uri.fragment);
        final data = jsonDecode(fragment);
        if (data is Map && data['callback'] != null && data['request_id'] != null) {
          return await _handleCustomDisclosureRequest(rawValue);
        }
      } catch (e) {
        // Not a custom disclosure request, continue normal processing
      }
    }

    if (Environment.mockRepositories) {
      // Check if this is a card import QR code
      if (_isCardImportQr(rawValue)) {
        return await _handleCardImportQr(rawValue);
      }
      // When wallet_core supports issue/sign requests, this logic should be removed.
      if (rawValue.contains('issue')) return IssuanceNavigationRequest(rawValue);
      if (rawValue.contains('sign')) return SignNavigationRequest(rawValue);
    }

    final uriType = await _walletCore.identifyUri(rawValue);
    switch (uriType) {
      case IdentifyUriResult.PidIssuance:
        return PidIssuanceNavigationRequest(rawValue);
      case IdentifyUriResult.PidRenewal:
        return PidRenewalNavigationRequest(rawValue);
      case IdentifyUriResult.PinRecovery:
        return PinRecoveryNavigationRequest(rawValue);
      case IdentifyUriResult.Disclosure:
        return DisclosureNavigationRequest(rawValue, isQrCode: true);
      case IdentifyUriResult.DisclosureBasedIssuance:
        return IssuanceNavigationRequest(rawValue, isQrCode: true);
      case IdentifyUriResult.Transfer:
        return NavigationRequest.walletTransferSource(rawValue);
    }
  }

  Future<NavigationRequest> _handleCustomDisclosureRequest(String rawValue) async {
    Fimber.i('Detected custom disclosure request, processing...');
    try {
      final uri = Uri.parse(rawValue);
      final fragment = Uri.decodeComponent(uri.fragment);
      final data = jsonDecode(fragment) as Map<String, dynamic>;

      final callbackUrl = data['callback'] as String?;
      final requestId = data['request_id'] as String?;

      if (callbackUrl == null || requestId == null) {
        Fimber.e('Missing callback or request_id in custom disclosure URL');
        throw Exception('Invalid disclosure request: missing parameters');
      }

      Fimber.i('Custom disclosure request: callback=$callbackUrl, request_id=$requestId');

      // Get the first PID card from the wallet
      final cards = await _walletCore.observeCards().first.timeout(const Duration(seconds: 5));
      final pidCard = cards.firstWhere(
        (card) => card.attestationType.contains('pid') || card.attestationType.toLowerCase().contains('person'),
        orElse: () => throw Exception('No PID card found in wallet'),
      );

      // Extract attributes from the card
      final attributes = <String, dynamic>{};
      for (final attr in pidCard.attributes) {
        final value = attr.value;
        if (value is AttributeValue_String) {
          attributes[attr.key] = value.value;
        } else if (value is AttributeValue_Boolean) {
          attributes[attr.key] = value.value;
        } else if (value is AttributeValue_Date) {
          attributes[attr.key] = value.value;
        }
      }

      Fimber.i('Extracted ${attributes.length} attributes from PID card');

      // Send disclosure data to callback endpoint
      final response = await http.post(
        Uri.parse(callbackUrl),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'request_id': requestId,
          'credentials': attributes,
        }),
      );

      if (response.statusCode == 200) {
        Fimber.i('Successfully sent disclosure data to callback');
      } else {
        Fimber.e('Failed to send disclosure data: ${response.statusCode}');
        throw Exception('Callback failed with status ${response.statusCode}');
      }

      // Return to dashboard after successful disclosure
      return NavigationRequest.dashboard();
    } catch (e, stackTrace) {
      Fimber.e('Failed to process custom disclosure request', ex: e, stacktrace: stackTrace);
      rethrow;
    }
  }

  bool _isCardImportQr(String rawValue) {
    try {
      final data = jsonDecode(rawValue);
      return data is Map && data['type'] == 'nl_wallet_card_import';
    } catch (e) {
      return false;
    }
  }

  Future<NavigationRequest> _handleCardImportQr(String rawValue) async {
    Fimber.i('Detected card import QR code, processing...');
    try {
      final qrData = jsonDecode(rawValue) as Map<String, dynamic>;
      final cardData = qrData['card'] as Map<String, dynamic>;

      // Convert to AttestationPresentation and add to wallet
      final attestation = _convertQrDataToAttestation(cardData);
      await _walletCore.importCardFromQr(attestation);

      Fimber.i('Successfully imported card from QR code');
      // Return a navigation request that goes back to dashboard
      return NavigationRequest.dashboard();
    } catch (e, stackTrace) {
      Fimber.e('Failed to import card from QR', ex: e, stacktrace: stackTrace);
      rethrow;
    }
  }

  AttestationPresentation _convertQrDataToAttestation(Map<String, dynamic> cardData) {
    // Parse issuer
    final issuerData = cardData['issuer'] as Map<String, dynamic>;
    final issuerNameMap = issuerData['name'] as Map<String, dynamic>;
    final issuer = Organization(
      legalName: _convertToLocalizedStringList(issuerNameMap),
      displayName: _convertToLocalizedStringList(issuerNameMap),
      description: [],
      category: [const LocalizedString(language: 'nl-NL', value: 'test_category')],
      webUrl: null,
      privacyPolicyUrl: null,
    );

    // Parse attributes
    final attributesData = cardData['attributes'] as List<dynamic>;
    final attributes = attributesData.map((attrData) {
      final attr = attrData as Map<String, dynamic>;
      final labelMap = attr['label'] as Map<String, dynamic>;
      final valueMap = attr['value'] as Map<String, dynamic>;

      // Create labels from the label map (one per language)
      final labels = labelMap.entries.map((entry) {
        return ClaimDisplayMetadata(
          lang: entry.key,
          label: entry.value.toString(),
        );
      }).toList();

      // Get value string (use first available language)
      final valueStr = valueMap.values.first.toString();

      return AttestationAttribute(
        key: attr['type'] as String,
        labels: labels,
        value: AttributeValue.string(value: valueStr),
      );
    }).toList();

    // Parse metadata
    final metadataData = (cardData['metadata'] as List<dynamic>?) ?? [];
    final metadata = metadataData.map((metaData) {
      final meta = metaData as Map<String, dynamic>;
      final textMap = meta['text'] as Map<String, dynamic>;
      final metaType = meta['type'] as String;

      return _createDisplayMetadata(metaType, textMap);
    }).toList();

    // If no metadata provided, create a default one
    if (metadata.isEmpty) {
      final attestationType = cardData['attestationType'] as String;
      metadata.add(DisplayMetadata(
        lang: 'nl-NL',
        name: attestationType,
      ));
    }

    // Create the attestation presentation (without status/dates - those are managed by WalletCard mapper)
    return AttestationPresentation(
      identity: const AttestationIdentity.ephemeral(),
      attestationType: cardData['attestationType'] as String,
      issuer: issuer,
      attributes: attributes,
      displayMetadata: metadata,
    );
  }

  List<LocalizedString> _convertToLocalizedStringList(Map<String, dynamic> textMap) {
    return textMap.entries.map((entry) {
      return LocalizedString(
        language: entry.key,
        value: entry.value.toString(),
      );
    }).toList();
  }

  DisplayMetadata _createDisplayMetadata(String type, Map<String, dynamic> textMap) {
    // Use first language entry for name
    final firstEntry = textMap.entries.first;
    return DisplayMetadata(
      lang: firstEntry.key,
      name: firstEntry.value.toString(),
    );
  }
}
