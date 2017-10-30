// Node.js server for Google Speech Demo 

'use strict'

// configure express app
var port = process.env.PORT || 3000;
var express = require('express');
var app = express();
var session = require('express-session');
app.use(express.static(__dirname + '/public'));
app.use(session({    
    secret : 'haveaniceday',
    resave : false,
    saveUninitialized: true
}));
app.set('views', __dirname + '/templates');
app.set('view engine', 'jade');
app.engine('jade', require('jade').__express);

// start web server
let server = app.listen(port, () => console.log(`Listening on ${ port }`));  

// configure websocket server
var WebSocketServer = require("ws").Server;

// route
app.get('/', function(req, res){
    res.render('index');
  }
);

/*================================================

Google Speech connection for speech to text

==================================================*/

const Speech = require('@google-cloud/speech');

// hacky way to show Google Speech credential as a file location; helpful when hosting outside Google Cloud
function loadGoogleCrendential() {
  var fs = require('fs');
  const dir = './tmp';
  if (!fs.existsSync(dir)){
      fs.mkdirSync(dir);
  }
  const encoded = process.env.ENCODED; // authentication.json file is base64 encoded as this ENV variable
  const decoded = new Buffer(encoded, 'base64').toString('utf8');
  fs.writeFile(dir + "/tmp.json", decoded, function(err) {
      if(err) {
          return console.log(err);
      }
  }); 
  process.env['GOOGLE_APPLICATION_CREDENTIALS'] = dir + "/tmp.json";
}
loadGoogleCrendential(); // load the credential on app startup

function startGoogleSpeechStream(ws) {      
  var request = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 44100,
      languageCode: 'en-US'   
    },
    interimResults: false, // set to true to receive in-progress guesses
    singleUtterance: false // set to true to close stream after a finished utterance
  };    
  var recognizeStream = Speech().streamingRecognize(request)        
    .on('error', (err) => {
      console.log(`ERROR: On Streaming recognize stream: ${err}`);
      return ws.terminate(); 
    })
    .on('data', (data) => {            
      var text = data.results[0].alternatives[0].transcript;
      ws.send(`[Heard]: ${text}`); // send transcript to client                                    
    });
  return recognizeStream;
}


/*================================================

Websocket connection to client browsers

==================================================*/

var WebSocketServer = require("ws").Server;
var wss = new WebSocketServer({ server:server });

wss.on('connection', function (ws) {  
  console.log('Client connected: ' + ws._ultron.id);  
  var gstreams = []; // keeep track of speech streams
  var activeStreamID = -1; // pointer to active speech stream
  ws.on('message', function (data) {         
    if ( typeof data == 'string' ) { 
      if (data.indexOf("info")>0) { // client sends an info string on connection that triggers server to start a speech stream             
        console.log('Start first stream');
        gstreams.push(startGoogleSpeechStream(ws));
        activeStreamID = activeStreamID + 1;           
      }
      else { // client requested a new speech stream (client-side logic allows for triggering on a lull in input volume)
        console.log('Start another stream');
        gstreams[activeStreamID].end();
        gstreams.push(startGoogleSpeechStream(ws));
        activeStreamID = activeStreamID + 1;                              
      }    
    }    
    else  { 
      gstreams[activeStreamID].write(data); // client sent audio, push it to active speech stream 
    }        
  });  
  ws.on('close', function () {
     console.log('Client disconnected');
     ws.isAlive = false;
     gstreams[activeStreamID].end();
  });  
  ws.on('error', function (err) {
     console.log(`Web socket error ${err.message}`);
  });  
});
