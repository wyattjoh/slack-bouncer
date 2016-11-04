const express = require('express');
const proxy = require('express-http-proxy');
const request = require('request');
const defaults = require('defaults');

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
 * Actually perform the proxy.
 */
function Proxy() {
  return proxy(process.env.TARGET_URL, {
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
    intercept: (rsp, data, req, res, callback) => {

      console.log(`INTERCEPT: ${req.method} ${req.path}`);

      try {
        // Perform the interception.
        handle(rsp, data, req, res);
      } catch(e) {
        console.error('INTERCEPT HANDLE FAILURE: ' + e.message);
      }

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

function IdentifyReply(reply) {
  if (reply.answer.options) {
    return `*${reply.question}*: ${reply.answer.options.map((o) => o.title).join(', ')}`;
  } else if (reply.answer.text) {
    return `*${reply.question}*: ${reply.answer.text}`;
  }
}

app.post('/v1/form/:form_id/submission', Intercept((rsp, data) => {
  const submission = JSON.parse(data.toString('ascii'));
  const answers = submission.replies.map(IdentifyReply).map((a) => '> ' + a);

  // Build the slack message array.
  const messageLines = [
    `*${submission.header.title || 'Form'}* Submission *#${submission.number}* at *${new Date(submission.date_created).toString()}*`
  ].concat(answers);

  // Assemble the messages.
  const message = messageLines.join('\n');

  // Actually send the slack message.
  SendSlackMessage(message);
}));

/**
 * Proxy the rest of the requests directly.
 */

app.use('/', Proxy());

/**
 * Start the web server.
 */

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log('Now listening on port ' + port);
});
