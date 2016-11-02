const express = require('express');
const proxy = require('express-http-proxy');
const request = require('request');
const defaults = require('defaults');
const url = require('url');
const path = require('path');

/**
 * Sends a slack message.
 */
function SendSlackMessage(message, options) {
  options = defaults(options, {
    channel: '#' + process.env.SLACK_CHANNEL,
    username: process.env.SLACK_USERNAME,
    icon_emoji: process.env.SLACK_ICON_EMOJI
  });

  let payload = {
    channel: options.channel,
    username: options.username,
    text: message,
    icon_emoji: options.icon_emoji
  };

  if (process.env.DISABLE_SLACK === 'TRUE') {
    console.log(JSON.stringify(payload));

    return;
  }

  request({
    method: 'POST',
    json: true,
    url: process.env.SLACK_URL,
    body: payload
  }, (err, httpResponse, body) => {
    if (err) {
      console.error(err);
      return;
    }

    console.log('Slack message was sent!');
  });
}

/**
 * Rewrites the path so that it is relative to the target url.
 */
function RewritePath(req, res) {
  const targetUrl = url.parse(process.env.TARGET_URL);

  targetUrl.pathname = path.join(targetUrl.pathname, url.parse(req.url).path);

  return url.format(targetUrl);
}

/**
 * Actually perform the proxy.
 */
function Proxy() {
  return proxy(process.env.TARGET_URL, {
    forwardPath: RewritePath,
    intercept: (rsp, data, req, res, callback) => {
      console.log(`PROXY: ${req.method} ${req.path}`);

      // Continue the request.
      callback(null, data);
    }
  });
}

/**
 * Perform an intercept and run the handle before sending data back to the
 * client.
 */
function Intercept(handle) {
  return proxy(process.env.TARGET_URL, {
    forwardPath: RewritePath,
    intercept: (rsp, data, req, res, callback) => {

      console.log(`INTERCEPT: ${req.method} ${req.path}`);

      // Perform the interception.
      handle(rsp, data, req, res);

      // Continue the request.
      callback(null, data);
    }
  })
}

/**
 * Create the Express App
 */

const app = express();

/**
 * Create all the excepted routes here with custom bindings.
 */

if (process.env.MAPPINGS && process.env.MAPPINGS.length > 0) {
  try {
    const mappings = JSON.parse(process.env.MAPPINGS);

    if (!Array.isArray(mappings)) {
      console.error('Mappings JSON is not an array, expecting it to be.');
      process.exit(1);
    }

    if (mappings.length % 3 != 0) {
      console.error('Expected mappings to be in three\'s, that\'s not the case.');
      process.exit(1);
    }

    for (let i = 0; i < mappings.length; i++) {
      if (i % 3 != 0) {
        continue;
      }

      // Map the paths from the url.
      (function(method, path, message) {
        console.log(`Mapped: '${method} ${path}' => '${message}'`);

        switch (method) {
          case 'POST':
            app.post(path, Intercept(() => SendSlackMessage(message)));
            break;
          case 'GET':
            app.get(path, Intercept(() => SendSlackMessage(message)));
            break;
          case 'PUT':
            app.put(path, Intercept(() => SendSlackMessage(message)));
            break;
          case 'DELETE':
            app.delete(path, Intercept(() => SendSlackMessage(message)));
            break;
        }
      })(mappings[i], mappings[i + 1], mappings[i + 2]);
    }

  } catch (e) {
    console.error(`Couldn't parse the mappings JSON: ${e.message}`);
  }
}

/**
 * Proxy the rest of the requests directly.
 */

app.use('/', Proxy());

/**
 * Start the web server.
 */

app.listen(3000, () => {
  console.log('Now listening on port 3000');
});
