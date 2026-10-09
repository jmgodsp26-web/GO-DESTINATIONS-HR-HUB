// Defensive guard against browser extension injection conflicts (e.g. MetaMask / Web3 wallets redefining window.ethereum)
      (function() {
        try {
          var originalDefineProperty = Object.defineProperty;
          Object.defineProperty = function(obj, prop, descriptor) {
            if (obj === window && prop === 'ethereum') {
              try {
                return originalDefineProperty.call(Object, obj, prop, {
                  ...descriptor,
                  configurable: true,
                  writable: true,
                });
              } catch (err) {
                try {
                  if (descriptor && descriptor.value !== undefined) {
                    window.ethereum = descriptor.value;
                  }
                } catch (_) {}
                return obj;
              }
            }
            return originalDefineProperty.call(Object, obj, prop, descriptor);
          };
        } catch (_) {}

        var suppressError = function(msg) {
          return typeof msg === 'string' && (
            msg.indexOf('ethereum') !== -1 ||
            msg.indexOf('Cannot redefine property: ethereum') !== -1 ||
            msg.indexOf('Cannot redefine property') !== -1
          );
        };

        window.addEventListener('error', function(event) {
          if (event && (suppressError(event.message) || (event.error && suppressError(event.error.message)))) {
            event.stopImmediatePropagation();
            event.preventDefault();
          }
        }, true);

        window.addEventListener('unhandledrejection', function(event) {
          if (event && event.reason) {
            var reasonMsg = typeof event.reason === 'string' ? event.reason : (event.reason.message || '');
            if (suppressError(reasonMsg)) {
              event.stopImmediatePropagation();
              event.preventDefault();
            }
          }
        }, true);

        var prevOnError = window.onerror;
        window.onerror = function(message, source, lineno, colno, error) {
          if (suppressError(message) || (error && suppressError(error.message))) {
            return true;
          }
          if (typeof prevOnError === 'function') {
            return prevOnError.apply(this, arguments);
          }
          return false;
        };
      })();
