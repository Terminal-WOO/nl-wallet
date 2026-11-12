import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';

import '../../../environment.dart';
import '../../data/repository/wallet/wallet_repository.dart';
import '../../navigation/wallet_routes.dart';
import '../../util/extension/build_context_extension.dart';
import '../../wallet_assets.dart';
import '../../wallet_constants.dart';
import '../common/widget/government_logo.dart';
import '../common/widget/utility/do_on_init.dart';
import '../common/widget/wallet_logo.dart';
import 'bloc/splash_bloc.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DoOnInit(
      key: const Key('splash_screen_on_init'),
      onInit: (context) {
        FlutterNativeSplash.remove();
        WalletAssets.preloadPidSvgs();
      },
      child: BlocListener<SplashBloc, SplashState>(
        listenWhen: (prev, current) => current is SplashLoaded,
        listener: (context, state) {
          if (state is SplashLoaded) {
            _handleSplashLoaded(context, state);
          }
        },
        child: _buildContent(context),
      ),
    );
  }

  Future<void> _handleSplashLoaded(BuildContext context, SplashLoaded state) async {
    // Auto-unlock wallet in mock mode to skip PIN
    if (state.isRegistered && Environment.mockRepositories) {
      try {
        final walletRepository = context.read<WalletRepository>();
        // Try to unlock with mock PIN
        await walletRepository.unlockWallet(kMockPin);
      } catch (e) {
        // Ignore errors, wallet might already be unlocked
      }
    }
    
    // Check if context is still mounted before navigating
    if (!context.mounted) return;
    
    // Navigate to dashboard which shows saved cards and QR button
    if (state.isRegistered && state.hasPid) {
      // Wallet is initialized, go directly to dashboard
      Navigator.restorablePushReplacementNamed(context, WalletRoutes.dashboardRoute);
    } else if (state.isRegistered && !state.hasPid) {
      // Registered but no PID, go to personalization
      Navigator.restorablePushReplacementNamed(context, WalletRoutes.walletPersonalizeRoute);
    } else {
      // Not registered, go to introduction
      Navigator.restorablePushReplacementNamed(context, WalletRoutes.introductionRoute);
    }
  }

  /// Build the visual part of the SplashScreen
  Widget _buildContent(BuildContext context) {
    return Stack(
      children: [
        Scaffold(
          key: const Key('splashScreen'),
          body: Center(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                const WalletLogo(size: 100),
                const SizedBox(height: 16),
                Text(
                  context.l10n.appTitle,
                  style: context.textTheme.titleMedium,
                ),
              ],
            ),
          ),
        ),
        const Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: ExcludeSemantics(
            child: GovernmentLogo(),
          ),
        ),
      ],
    );
  }
}
