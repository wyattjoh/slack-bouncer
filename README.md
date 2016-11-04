# Slack Bouncer

##Slack Integration for Ask

Now you can get notifications on Slack when new form submissions come in.

1. Create a Slack incoming webhook (see: https://api.slack.com/incoming-webhooks)

2. Run the Ask installer and choose 'y' for Slack integration:

```
Do you want form submissions to post to a slack channel?
```

3. Input your incoming webhook url:

```
What is the slack incoming hook url?:
```

4. And finally, enter the channel where you want to receive the notifications:

```
What is the slack channel you want notifications posted? (without the #):
```

## Config

- PORT
- SLACK_URL
- SLACK_CHANNEL
- SLACK_USERNAME
- SLACK_ICON_EMOJI
- TARGET_URL
- MAPPINGS
- DISABLE_SLACK
