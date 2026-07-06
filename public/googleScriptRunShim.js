(function () {
  function callAppsScript(functionName, args, successHandler, failureHandler, userObject) {
    fetch('/api/apps-script/' + encodeURIComponent(functionName), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: Array.prototype.slice.call(args || []) })
    })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok) {
            throw new Error(payload && payload.message ? payload.message : 'Request failed');
          }
          return payload;
        });
      })
      .then(function (payload) {
        if (typeof successHandler === 'function') successHandler(payload, userObject);
      })
      .catch(function (error) {
        if (typeof failureHandler === 'function') failureHandler(error, userObject);
        else console.error('google.script.run bridge error:', functionName, error);
      });
  }

  function createRunner(successHandler, failureHandler, userObject) {
    var chain = {
      withSuccessHandler: function (handler) {
        return createRunner(handler, failureHandler, userObject);
      },
      withFailureHandler: function (handler) {
        return createRunner(successHandler, handler, userObject);
      },
      withUserObject: function (object) {
        return createRunner(successHandler, failureHandler, object);
      }
    };

    return new Proxy(chain, {
      get: function (target, prop) {
        if (prop in target) return target[prop];
        return function () {
          callAppsScript(String(prop), arguments, successHandler, failureHandler, userObject);
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.host = window.google.script.host || {
    close: function () {},
    setHeight: function () {},
    setWidth: function () {},
    editor: {
      focus: function () {}
    }
  };
  window.google.script.run = createRunner();
})();
