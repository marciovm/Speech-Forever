// Records audio from client browser and pushes it via websocket to Node server
"use strict"

var audioInput;
var context;
var streamStartTime;
var ws; 
var breakTime = 45000; // how long to wait before starting a new speech stream on lull in input volume
var volume = 0; // volume meter initial value 
var recording = false; 


/*================================================

Record audio from browser

==================================================*/

function startRecording() {
  showLoading();
  connectSocket();        
  
  var AudioContext = window.AudioContext || window.webkitAudioContext;    
  context = new AudioContext();
  var recorder = context.createScriptProcessor(2048, 1, 1);
  recorder.connect(context.destination);   
  
  var handleSuccess = function(stream) {
    setRecordingTrue(1000); // give socket 1 sec to open
    audioInput = context.createMediaStreamSource(stream);   
    audioInput.connect(recorder);            
    recorder.onaudioprocess = function(stream){
      if(!recording) return;
      var buf = stream.inputBuffer.getChannelData(0);        	  
      volume = detectVolume(buf, this);               
      $(".volume_meter")[0].value=volume * 100;      
      if (volume < 0.01 && (Date.now() > (streamStartTime + breakTime))) {    
        ws.send("restarting Google Stream");  
        console.log("restarting Google Stream");
        streamStartTime = Date.now();
        writeToCaret(' ');
      }   
      else {
        ws.send(float32ToInt16(buf)); // send audio stream to Node server   
      }     
    }    
  }  
  
  try {
    navigator.mediaDevices.getUserMedia({audio: true, video: false})
      .then(handleSuccess)
      .catch(function(err) { 
        alert('ERROR capturing audio: ' + err);
      });        
  }
  catch (err) {
    console.log(`Error starting getUserMedia.${err.name}: ${err.message}`);
  }  
}

function stopRecording() {
  $(".volume_meter")[0].value=0;
  recording = false;
  try {
    audioInput.mediaStream.getTracks()[0].stop()        
  }
  catch (err) {
    console.log(`ERROR unable to close media stream: ${err}`) // triggers on Firefox
  }
  context.close();    
  ws.close();
  $(".start-button").css("display", "inline");      
  $(".stop-button").css("display", "none");      
}


/*================================================

Websocket connection to Node server

==================================================*/

const host = location.origin.replace(/^http/, 'ws');

function connectSocket() { 
  
  ws = new WebSocket(host);
  var socketTimerInterval;
  
  ws.onopen = function() {   
    ws.send('new user info');
    console.log('opened socket')    
  };
  
  // handle inbound transcripts from Node server
  ws.onmessage = function(message) {            
    if (message.data.substring(0,7) == "[Heard]") {
      $(".guess")[0].innerHTML = ''
      var str = message.data.substring(9);
      writeToCaret(str);        
    }    
    else if (message.data.substring(0,7) == "[Error]") {
      console.log('error')
    }        
  };

  ws.onclose = function() {           
    clearInterval(socketTimerInterval);
    console.log('closed socket');     
    if (recording) {
      stopRecording();
    }    
  }; 
}

/*================================================

Helpers

==================================================*/


// caret position helper from https://github.com/accursoft/caret
function writeToCaret(string) {
  console.log("======Writing======: "  + string)     
  var caret_pos = $('.guess').caret();
  var pre_caret = $('.guess').val().substring(0, caret_pos);    
  $('.guess').val(pre_caret + string); 
  $('.guess').caret(caret_pos + string.length);    
}

function showLoading() {
  $(".start-button").css("display", "none");
  $(".processing-button").css("display", "inline");               
}

function setRecordingTrue(delay) {
  setTimeout(function() { // web socket needs time to connect before accepting audio
    recording = true;
    streamStartTime = Date.now() 
    $(".processing-button").css("display", "none");      
    $(".stop-button").css("display", "inline");      
  }, delay);
}

function detectVolume(buf, recorder_context) {
  var bufLength = buf.length;
  var sum = 0;
  var x;
  for (var i=0; i<bufLength; i++) {
  	x = buf[i];
  	if (Math.abs(x)>=recorder_context.clipLevel) {
  		recorder_context.clipping = true;
  		recorder_context.lastClip = window.performance.now();
  	}
  	sum += x * x;
  }
  var rms =  Math.sqrt(sum / bufLength);  
  return Math.max(rms, volume*.85); // smoothing 
}

// audio helper
function float32ToInt16(buffer) {
  var l = buffer.length;
  var buf = new Int16Array(l);

  while (l--) {
    buf[l] = buffer[l]*0xFFFF;    //convert to 16 bit
  }  
  return buf.buffer
}



