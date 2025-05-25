# Bluesky Group Chat Demo

Here's how to create a simple group chat on Bluesky. The basic concept is to use a bot account to forward messages between multiple users.

Here's what it looks like:

<img width="588" alt="GC demo" src="https://github.com/user-attachments/assets/b5117c20-9c5a-484d-a818-3d10fb7b7f2a" />

## Setup
1. Create a new account for your group chat (make sure to verify the email)
2. Chat membership is determined by active conversations within the bot account. To include a user in the group chat, simply send them a message from the bot account manually.
3. Create a .env file with the DID and PASSWORD of the GC account and run the node.js service on the server of your choice to sync messages between users

And that's it!

Note: Follower/following relationships for the bot account are unrelated to GC membership.

## Script details

Every 10 seconds, the script will:
1. Pull the last 50 messages for each conversation of the bot account
2. For each conversation, if there is a user message that isn't present in other the conversations, send it to the other users

## Limitations

- Reactions aren't sent between users.

- There may be a >10 second latency before messages are forwarded.

- This is a proof-of-concept hacked together in an afternoon. Script may be buggy, or may not scale well. Use at your own risk!
