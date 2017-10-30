## Google Speech streaming recognition API demo

Demo speech-to-text on your browser via the Google Speech streaming recognition API on a Node server. I ran into a few gotchas when fiddling with this approach, so I thought it might be helpful to share how I got it to work.

The server manages two connections:
- a websocket between the server and your browser
- a streaming recognition stream between the server and Google Speech 

This demo sidesteps the 1 min stream API limit by creating a series of streaming objects as needed. A new stream is requested by the client browser upon a lull in input volume.

The view includes a volume meter for debugging audio input issues. Getting audio input right across browsers is tricky.

### Instructions

**First**, base64 encode your Google .json credential file, then set the result to the env variable process.env.ENCODED.

For example, on MacOS:

- $ openssl base64 -in [Google-credential-file.json]
- in your .bash_profile, add "export ENCODED=[base64-encoded-result]"

**Then**, clone and run the app:

- clone this repo
- $ npm install
- $ node app.js
- point browser to localhost:3000
- click the start button

### Browser support

- Verified on Chrome, Firefox, Safari (v11+), and mobile Safari.
- Safari requires https to enable getUserMedia. An nGrok tunnel provides a simple, free workaround for development.
- On mobile Safari, note that starting the audio context must be tied to a user click event.
