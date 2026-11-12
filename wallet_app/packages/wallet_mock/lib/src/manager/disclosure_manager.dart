import 'dart:convert';

import 'package:wallet_core/core.dart';

import '../data/mock/mock_disclosure_requests.dart';
import '../log/wallet_event_log.dart';
import '../util/extension/string_extension.dart';
import '../wallet/wallet.dart';
import 'pin_manager.dart';

import 'dart:io';

/// This class manages (mock) disclosure sessions. Previously this was part of the
/// [WalletCoreMock] directly but moved for better separation of concerns.
class DisclosureManager {
  final PinManager _pinManager;
  final Wallet _wallet;
  final WalletEventLog _eventLog;

  StartDisclosureResult? _ongoingDisclosure;
  String? _currentSessionToken;

  bool get hasActiveDisclosureSession => _ongoingDisclosure != null;

  DisclosureManager(this._pinManager, this._wallet, this._eventLog);

  String _extractAttributeValue(AttributeValue value) {
    return switch (value) {
      AttributeValue_String(:final value) => value,
      AttributeValue_Boolean(:final value) => value.toString(),
      AttributeValue_Number(:final value) => value.toString(),
      AttributeValue_Date(:final value) => value,
      AttributeValue_Array(:final value) => value.map(_extractAttributeValue).join(', '),
      AttributeValue_Null() => '',
    };
  }

  Future<StartDisclosureResult> startDisclosure(String uri, {required bool isQrCode}) async {
    final jsonPayload = jsonDecode(Uri.decodeComponent(Uri.parse(uri).fragment));
    
    // Capture session token if present (for PoC callback)
    if (jsonPayload is Map && jsonPayload.containsKey('session_token')) {
      _currentSessionToken = jsonPayload['session_token'] as String;
      print('📝 Captured session token: $_currentSessionToken');
    } else {
      _currentSessionToken = null;
    }

    // Look up the associated request
    final disclosureId = jsonPayload['id'] as String;
    final request = kDisclosureRequests.firstWhere((element) => element.id == disclosureId);
    final requestOriginBaseUrl = request.relyingParty.webUrl ?? 'http://origin.org';

    // Check if all attributes are available
    final containsAllRequestedAttributes = _wallet.containsAttributes(
      request.requestedAttributes.map((requestedAttribute) => requestedAttribute.key),
    );
    if (containsAllRequestedAttributes) {
      final isLoginRequest =
          request.requestedAttributes.length == 1 && request.requestedAttributes.first.key == 'mock_citizenshipNumber';
      final requestedAttestations = _wallet.getRequestedAttestations(
        request.requestedAttributes.map((attribute) => attribute.key),
      );
      return _ongoingDisclosure = StartDisclosureResult.request(
        relyingParty: request.relyingParty,
        policy: request.policy,
        disclosureOptions: requestedAttestations.map((it) => DisclosureOptions(field0: [it])).toList(),
        sharedDataWithRelyingPartyBefore: _eventLog.includesInteractionWith(request.relyingParty),
        sessionType: DisclosureSessionType.CrossDevice,
        requestOriginBaseUrl: requestOriginBaseUrl,
        requestPurpose: request.purpose.untranslated,
        requestType: isLoginRequest ? DisclosureType.Login : DisclosureType.Regular,
      );
    } else {
      final requestedAttributesNotInWallet = _wallet.getMissingAttributeKeys(
        request.requestedAttributes.map((e) => e.key),
      );
      final missingAttributes = requestedAttributesNotInWallet.map((key) {
        final associatedLabel = request.requestedAttributes.firstWhere((element) => element.key == key).label;
        return MissingAttribute(labels: associatedLabel.untranslated);
      });
      return _ongoingDisclosure = StartDisclosureResult.requestAttributesMissing(
        relyingParty: request.relyingParty,
        sharedDataWithRelyingPartyBefore: _eventLog.includesInteractionWith(request.relyingParty),
        sessionType: DisclosureSessionType.CrossDevice,
        requestOriginBaseUrl: requestOriginBaseUrl,
        requestPurpose: request.purpose.untranslated,
        missingAttributes: missingAttributes.toList(),
      );
    }
  }

  Future<void> cancelDisclosure() async {
    final disclosure = _ongoingDisclosure;
    assert(disclosure != null, 'No ongoing disclosure to deny');
    _ongoingDisclosure = null;
    _currentSessionToken = null;
    _eventLog.logDisclosure(disclosure!, DisclosureStatus.Cancelled);
  }

  Future<AcceptDisclosureResult> acceptDisclosure(String pin) async {
    final disclosure = _ongoingDisclosure;
    assert(disclosure != null, 'No ongoing disclosure to accept');
    assert(disclosure is StartDisclosureResult_Request, "Can't accept disclosure with missing attributes");

    // Check if correct pin was provided
    final result = _pinManager.checkPin(pin);
    if (result is WalletInstructionResult_InstructionError) {
      switch (result.error) {
        case WalletInstructionError_Timeout():
        case WalletInstructionError_Blocked():
          _wallet.lock();
        case WalletInstructionError_IncorrectPin():
      }
      return AcceptDisclosureResult.instructionError(error: result.error);
    }

    // Log successful disclosure
    _eventLog.logDisclosure(disclosure!, DisclosureStatus.Success);
    
    // Send data back to server if we have a session token
    if (_currentSessionToken != null) {
      print('🔄 Session token found: $_currentSessionToken');
      print('🔄 Sending data to server...');
      // Await to ensure data is sent before clearing the token
      try {
        await _sendDisclosureData(disclosure, _currentSessionToken!);
        print('✅ Callback completed successfully');
      } catch (e, stackTrace) {
        print('❌ Callback failed: $e');
        print('❌ Stack trace: $stackTrace');
      }
    } else {
      print('⚠️ No session token found, skipping callback');
      print('⚠️ This means the QR code did not contain a session_token');
    }

    _ongoingDisclosure = null;
    _currentSessionToken = null;

    return const AcceptDisclosureResult.ok();
  }

  Future<void> _sendDisclosureData(StartDisclosureResult disclosure, String sessionToken) async {
    try {
      print('📤 Sending disclosure data for session: $sessionToken');
      
      final attributes = <Map<String, dynamic>>[];
      
      if (disclosure is StartDisclosureResult_Request) {
          for (final option in disclosure.disclosureOptions) {
              for (final card in option.field0) {
                  for (final attr in card.attributes) {
                      // Get the first available translation or empty string
                      final label = attr.labels.isNotEmpty ? attr.labels.first.label : attr.key;
                      final value = _extractAttributeValue(attr.value);
                      
                      attributes.add({
                          'type': attr.key,
                          'label': label,
                          'value': value,
                      });
                  }
              }
          }
      }

      print('📋 Prepared ${attributes.length} attributes to send');

      final payload = {
        'sessionToken': sessionToken,
        'attributes': attributes,
      };

      // Determine the correct server URL
      // On iOS Simulator: localhost works
      // On real iOS device: need to use Mac's IP address (e.g., 192.168.x.x)
      // For Android Emulator: use 10.0.2.2
      // Try to get from environment or use localhost as fallback
      // Default to 192.168.1.130 (your Mac's IP) for real devices
      final serverHost = Platform.environment['POC_SERVER_HOST'] ?? '192.168.1.130';
      final serverUrl = 'http://$serverHost:3000/api/callback';
      
      print('📤 Sending to: $serverUrl');
      print('📤 Payload: ${jsonEncode(payload)}');

      final client = HttpClient();
      final request = await client.postUrl(Uri.parse(serverUrl));
      request.headers.set('Content-Type', 'application/json');
      request.write(jsonEncode(payload));
      final response = await request.close();
      
      final responseBody = await response.transform(utf8.decoder).join();
      print('✅ Sent disclosure data to server: ${response.statusCode}');
      print('📥 Response: $responseBody');
      
      if (response.statusCode != 200) {
        print('⚠️ Warning: Server returned status ${response.statusCode}');
      }
    } catch (e, stackTrace) {
      print('❌ Failed to send disclosure data: $e');
      print('❌ Stack trace: $stackTrace');
    }
  }
}
