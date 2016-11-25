// Run StartVidyoConnector when the VidyoClient is successfully loaded
function StartVidyoConnector(VC) {
    var vidyoConnector;
    var cameras = {};
    var microphones = {};
    var speakers = {};
    var cameraPrivacy = false;
    var microphonePrivacy = false;
    var callState = "IDLE"

    VC.CreateVidyoConnector({
        viewId: "renderer", 		// Div ID where the composited video will be rendered, see VidyoConnectorSample.html
		viewStyle: "VIDYO_CONNECTORVIEWSTYLE_Default", // Visual style of the composited renderer
        remoteParticipants: 16,     // Maximum number of participants
        logFileFilter: "warning all@VidyoConnector info@VidyoClient",
    }).then(function(vc) {
        vidyoConnector = vc;
        parseUrlParameters(vidyoConnector);
        registerDeviceListeners(vidyoConnector, cameras, microphones, speakers);
        handleDeviceChange(vidyoConnector, cameras, microphones, speakers);
    }).catch(function() {
        console.error("CreateVidyoConnector Failed");
    });
    
    // Handle the camera privacy button, toggle between show and hide.
    $("#cameraButton").click(function() {
        // CameraPrivacy button clicked 
        cameraPrivacy = !cameraPrivacy;
        vidyoConnector.SetCameraPrivacy({
            privacy: cameraPrivacy,
        }).then(function() {
            if (cameraPrivacy) {
                $("#cameraButton").addClass("cameraOff").removeClass("cameraOn");
            } else {
                $("#cameraButton").addClass("cameraOn").removeClass("cameraOff");
            }
            console.log("SetCameraPrivacy Success");
        }).catch(function() {
            console.error("SetCameraPrivacy Failed");
        });
    });

    // Handle the microphone mute button, toggle between mute and unmute audio.
    $("#microphoneButton").click(function() {
        // MicrophonePrivacy button clicked 
        microphonePrivacy = !microphonePrivacy;
        vidyoConnector.SetMicrophonePrivacy({
            privacy: microphonePrivacy
        }).then(function() {
            if (microphonePrivacy) {
                $("#microphoneButton").addClass("microphoneOff").removeClass("microphoneOn");
            } else {
                $("#microphoneButton").addClass("microphoneOn").removeClass("microphoneOff");
            }
            console.log("SetMicrophonePrivacy Success");
        }).catch(function() {
            console.error("SetMicrophonePrivacy Failed");
        });
    });
	
	function join() {
		$("#connectionStatus").html("Connecting...");
		connectToConference(vidyoConnector);
		$("#joinLeaveButton").removeClass("callStart").addClass("callEnd");
        $('#joinLeaveButton').prop('title', 'Leave Conference');
		$("#joinLeaveButton").one("click", leave);
	}
	function leave() {
        vidyoConnector.Disconnect().then(function() {
            console.log("Disconnect Success");
        }).catch(function() {
            console.error("Disconnect Failure");
        });
        $("#renderer").removeClass("rendererFullScreen").addClass("rendererWithOptions");
		$("#joinLeaveButton").removeClass("callEnd").addClass("callStart");
        $('#joinLeaveButton').prop('title', 'Join Conference');
		$("#joinLeaveButton").one("click", join);
	}

    // Handle the join/leave in the toolbar button being clicked by the end user.
	$("#joinLeaveButton").one("click", join);
	
}

function registerDeviceListeners(vidyoConnector, cameras, microphones, speakers) {
    // Handle appearance and disappearance of camera devices in the system
    vidyoConnector.RegisterLocalCameraEventListener({
        onAdded: function(camera) {
            // New camera is available 
            $("#cameras").append("<option value='" + camera.id + "'>" + camera.name + "</option>");
            cameras[camera.id] = camera;
        },
        onRemoved: function(camera) {
            // Existing camera became unavailable 
            $("#cameras option[value='" + camera.id + "']").remove();
            delete cameras[camera.id];
        },
        onSelected: function(camera) {
            // Camera was selected by you or automatically 
            $("#cameras option[value='" + camera.id + "']").prop('selected', true);
        }
    }).then(function() {
        console.log("RegisterLocalCameraEventListener Success");
    }).catch(function() {
        console.error("RegisterLocalCameraEventListener Failed");
    });


    // Handle appearance and disappearance of microphone devices in the system
    vidyoConnector.RegisterLocalMicrophoneEventListener({
        onAdded: function(microphone) {
            // New microphone is available 
            $("#microphones").append("<option value='" + microphone.id + "'>" + microphone.name + "</option>");
            microphones[microphone.id] = microphone;
        },
        onRemoved: function(microphone) {
            // Existing microphone became unavailable 
            $("#microphones option[value='" + microphone.id + "']").remove();
            delete microphones[microphone.id];
        },
        onSelected: function(microphone) {
            // Microphone was selected by you or automatically 
            $("#microphones option[value='" + microphone.id + "']").prop('selected', true);
        }
    }).then(function() {
        console.log("RegisterLocalMicrophoneEventListener Success");
    }).catch(function() {
        console.error("RegisterLocalMicrophoneEventListener Failed");
    });

    // Handle appearance and disappearance of speaker devices in the system
    vidyoConnector.RegisterLocalSpeakerEventListener({
        onAdded: function(speaker) {
            // New speaker is available 
            $("#speakers").append("<option value='" + speaker.id + "'>" + speaker.name + "</option>");
            speakers[speaker.id] = speaker;
        },
        onRemoved: function(speaker) {
            // Existing speaker became unavailable 
            $("#speakers option[value='" + speaker.id + "']").remove();
            delete speakers[speaker.id];
        },
        onSelected: function(speaker) {
            // Speaker was selected by you or automatically 
            $("#speakers option[value='" + speaker.id + "']").prop('selected', true);
        }
    }).then(function() {
        console.log("RegisterLocalSpeakerEventListener Success");
    }).catch(function() {
        console.error("RegisterLocalSpeakerEventListener Failed");
    });
}

function handleDeviceChange(vidyoConnector, cameras, microphones, speakers) {
    // Hook up camera selector functions for each of the available cameras 
    $("#cameras").change(function() {
        // Camera selected form the drop-down menu 
        $("#cameras option:selected").each(function() {
            camera = cameras[$(this).val()];
            vidyoConnector.SelectLocalCamera({
                camera: camera
            }).then(function() {
                console.log("SelectCamera Success");
            }).catch(function() {
                console.error("SelectCamera Failed");
            });
        });
    });

    // Hook up microphone selector functions for each of the available microphones 
    $("#microphones").change(function() {
        // Microphone selected form the drop-down menu 
        $("#microphones option:selected").each(function() {
            microphone = microphones[$(this).val()];
            vidyoConnector.SelectLocalMicrophone({
                microphone: microphone
            }).then(function() {
                console.log("SelectMicrophone Success");
            }).catch(function() {
                console.error("SelectMicrophone Failed");
            });
        });
    });

    // Hook up speaker selector functions for each of the available speakers 
    $("#speakers").change(function() {
        // Speaker selected form the drop-down menu 
        $("#speakers option:selected").each(function() {
            speaker = speakers[$(this).val()];
            vidyoConnector.SelectLocalSpeaker({
                speaker: speaker
            }).then(function() {
                console.log("SelectSpeaker Success");
            }).catch(function() {
                console.error("SelectSpeaker Failed");
            });
        });
    });

}

function getParticipantName(participant, cb) {
    if (!participant) {
        cb("Undefined");
        return;
    }
    
    participant.GetName().then(function(name) {
        cb(name);
    }).catch(function() {
        cb("GetNameFailed");
    });
}

function handleParticipantChange(vidyoConnector) {
    vidyoConnector.RegisterParticipantEventListener({
        onJoined: function(participant) {
            getParticipantName(participant, function(name) {
                $("#participantStatus").html("" + name + " Joined");
            });
        },
        onLeft: function(participant) {
            getParticipantName(participant, function(name) {
                $("#participantStatus").html("" + name + " Left");
            });
        },
        onDynamicChanged: function(participants, cameras) {
        	// Order of participants changed
        },
        onLoudestChanged: function(participant, audioOnly) {
            getParticipantName(participant, function(name) {
                $("#participantStatus").html("" + name + " Speaking");
            });
        }
    }).then(function() {
        console.log("RegisterParticipantEventListener Success");
    }).catch(function() {
        console.err("RegisterParticipantEventListener Failed");
    });
}

function parseUrlParameters(vidyoConnector) {
    // Fill in the form parameters from the URI 
    var host = getUrlParameterByName("host");
    if (host)
    	$("#host").val(host);
    var token = getUrlParameterByName("token");
    if (token)
    	$("#token").val(token);
    var displayName = getUrlParameterByName("displayName");
    if (displayName)
    	$("#displayName").val(displayName);
    var resourceId = getUrlParameterByName("resourceId")
    if (resourceId)
    	$("#resourceId").val(resourceId);
    var autoJoin = getUrlParameterByName("autoJoin")
    	
    // If the parameters are passed in the URI, do not display options dialog,
    // and automatically connect.	
    if (host && token && displayName && resourceId) {
        $("#optionsParameters").addClass("optionsHidePermanent");
    }
    if (autoJoin) {
        connectToConference(vidyoConnector);
    }

    return true;
}

// Attempt to connect to the conference
// We will also handle connection failures 
// and network or server-initiated disconnects.  
function connectToConference(vidyoConnector) { 
    
    // Clear messages
    $("#error").html("");
    $("#message").html("<h3 class='blink'>CONNECTING...</h3>");

    vidyoConnector.Connect({
        // Take input from options form
        host: $("#host").val(),
        token: $("#token").val(),
        displayName: $("#displayName").val(),
        resourceId: $("#resourceId").val(),

        // Define handlers for connection events.
        onSuccess: function() {
            // Connected
			$("#connectionStatus").html("Connected");
            $("#options").addClass("optionsHide");
            $("#renderer").addClass("rendererFullScreen").removeClass("rendererWithOptions");
            $("#message").html("");
            handleParticipantChange(vidyoConnector);
        },
        onFailure: function(reason) {
            // Failed 
			$("#connectionStatus").html("Failed");
            $("#joinLeaveButton").removeClass("callEnd").addClass("callStart");
            $("#message").html("");
            $("#error").html("<h3>Call Failed: " + reason + "</h3>");
        	$("#participantStatus").html("");
        },
        onDisconnected: function(reason) {
            // Disconnected 
			$("#connectionStatus").html("Disconnected");
            $("#message").html("Call Disconnected: " + reason);
            $("#joinLeaveButton").removeClass("callEnd").addClass("callStart");
            $("#options").removeClass("optionsHide");
            $("#renderer").removeClass("rendererFullScreen").addClass("rendererWithOptions");
        	$("#participantStatus").html("");
        }
    }).then(function(status) {
        if (status) {
            console.log("ConnectCall Success");
        } else {
            console.error("ConnectCall Failed");
        }
    }).catch(function() {
        console.error("ConnectCall Failed");
    });
}

// Extract the desired parameter from the browser's location bar
function getUrlParameterByName(name) {
    var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}
