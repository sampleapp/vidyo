import { 
    Component, 
    OnInit, 
    OnDestroy, 
    AfterViewInit,
    NgZone 
} from '@angular/core';

import {
    Jsonp,
    URLSearchParams 
} from '@angular/http';

import { Router,
         NavigationEnd, 
         NavigationStart,
         ActivatedRoute, 
         Params
} from '@angular/router';

import { Http } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/switchMap';
import { AuthHttp } from 'angular2-jwt';

const styles = require('./forumroom.css');
const template = require('./forumroom.html');

declare var VC: any;
declare var vcStatus: any;

@Component({
  selector: 'home',
  template: template,
  styles: [ styles ]
})
export class ForumRoom implements OnInit, AfterViewInit {
  jwt: string;
  decodedJwt: string;
  response: string;
  api: string;
  vidyoConnector: any;
  disco: boolean;
  cms = [];
  en:boolean;
  timeo: any;
  timeo1: any;
  topic:string;
  

  private sub: any;
  

  constructor(public router: Router,
    public http: Http,
    public authHttp: AuthHttp,
    private zone: NgZone,
    public route: ActivatedRoute) {
    console.log('Room created');
    this.jwt = localStorage.getItem('id_token');
    this.decodedJwt = this.jwt && window.jwt_decode(this.jwt);
    this.en = vcStatus;
    //const id: Observable<string> = route.params.map(p => p.foo);
  }

  isViydoLoaded() {
      return vcStatus;
  }

 init_later(self, host, token, dn, rid) {
     return function() {
         self.init(host, token, dn, rid);
     }
 }
  ngAfterViewInit() {
        console.log('ngView init after');
        this.sub = this.route.params.subscribe(params => {
        let host = params['host'];
        let token = params['token'];
        let dn = params['dn'];
        let rid = params['rid'];
        console.log('Oooooooooo');
        console.log('Token' + token);
        console.log(host + dn + rid);
        this.topic = rid;
        let self = this;

        if (!vcStatus) {
           console.log('client not ready...');
            if (vcStatus == false) {
                this.timeo = setInterval(() => {
                    console.log('set interval wait...');                      
                    this.zone.run(() => {
                        this.en = vcStatus;
                        console.log(vcStatus);
                        if (this.en) {
                            clearInterval(this.timeo);
                            setTimeout(this.init_later(self, host,token,dn,rid),5000);
                        }
                    });
                }, 1000);
            }
           return;
        } else {
            console.log('Normal init');
            // this.zone.run(() => {
            //     this.en = vcStatus;
            // });
            this.init(host, token, dn, rid);
        }
  });


  }
//   ngOnDoCheck() {
//       console.log('test.........');
//   }
  ngOnInit() {
    console.log('Init forumRoom');

    this.router.events.subscribe((val) => {
        console.log(val);
        let urlroot = val.url.split(';')[0];
        if (val instanceof NavigationEnd && urlroot !== '/forumroom') {

            this.setCamPrivacy(true);
            this.setMicPrivacy(true);

            if (!this.disco) {                
                this.disconnect();
            }
            console.log('navigated away');
        }
    });

    //let t = this.route.snapshot.queryParams['id']
    // this.route.params.switchMap((params: Params) => {
    //     //this.selectedId = +params['id'];
    //     console.log(params);
    //   })

     //this.init();
  }

  ngOnDestory() {
      console.log('Destroy');
      this.sub.unsubscribe();
  }

  logout() {
    localStorage.removeItem('id_token');
    this.router.navigate(['login']);
  }

  init(host, token, dn, rid) {
    //console.log(this)
    console.log('init vidyo');
    //clearInterval(this.timeo1);
    let self = this;
    VC.CreateVidyoConnector({
        viewId: 'renderer',
        viewStyle: 'VIDYO_CONNECTORVIEWSTYLE_Default',
        remoteParticipants: 16,
        //logFileFilter: 'warning all@VidyoConnector info@VidyoClient',
        logFileFilter: 'error@VidyoClient',
    }).then(function(vc) {
        //console.log(vc);        
        self.vidyoConnector = vc;
        console.log('ConnectorCreated');
        console.log(host);
        console.log(token);
        console.log(dn);
        console.log(rid);
        self.connect(host, token, dn, rid)
        //parseUrlParameters(vidyoConnector);
        //registerDeviceListeners(vidyoConnector, cameras, microphones, speakers);
        //handleDeviceChange(vidyoConnector, cameras, microphones, speakers);
    }).catch(function() {
        console.error('CreateVidyoConnector Failed');
    });
  }

  connect(host, token, dn, rid) {
    console.log(this.vidyoConnector);
    console.log(host)
    console.log(token)
    console.log(dn)
    console.log(rid)
    let self = this;

    this.vidyoConnector.Connect({
        host: host,
        token: token,
        displayName: dn,
        resourceId: rid,
        onSuccess: function() {
            console.log('passsed...');
            self.handleParticipantChange();
            self.initChat();
        },
        onFailure: function(reason) {
            console.log('failed');
        },
        onDisconnected: function(reason) {
            console.log('event disconneted');
        }
    }).then(function(status) {
        console.log(status);
        if (status) {
            console.log('ConnectCall Success');
            self.disco = true;
        } else {
            console.error('ConnectCall Failed');
            self.disco = false;
        }
    }).catch(function(t) {
        console.error('ConnectCall Failed' + t);
    });
 }

 disconnect() {
    this.vidyoConnector.Disconnect().then(function() {
            console.log('Disconnect Success');
    }).catch(function() {
            console.error('Disconnect Failure');
    });
 }

  handleParticipantChange() {
    let self = this;
    this.vidyoConnector.RegisterParticipantEventListener({
        onJoined: function(participant) {
            console.log('ABHI JOined');
            self.getParticipantName(participant, function(name) {
                //$('#participantStatus').html('' + name + ' Joined');
            });
        },
        onLeft: function(participant) {
            console.log('ABHI Left');
            self.getParticipantName(participant, function(name) {
                //$('#participantStatus').html('' + name + ' Left');
            });
        },
        onDynamicChanged: function(participants, cameras) {
                // Order of participants changed
                console.log('ABHI Dyn');
        },
        onChatMessageReceived: function(p, c) {
            console.log('ABHI chat msg got in paart');
        },
        onLoudestChanged: function(participant, audioOnly) {
            console.log('ABHI Loud');
            self.getParticipantName(participant, function(name) {
                //$('#participantStatus').html('' + name + ' Speaking');
            });
        },
        //new doc
        OnParticipantJoined: function(participant) {
                console.log('ABHI JOined1');
         },
	    OnParticipantLeft: function(participant)   {
            console.log('ABHI Left1');
        },
	    OnDynamicParticipantChanged: function(participants) {
            console.log('ABHI Dyn1');
        },
	    OnLoudestParticipantChanged: function(participant, audioOnly) {
            console.log('ABHI Loud1');
        }

    }).then(function() {
        console.log('RegisterParticipantEventListener Success');
    }).catch(function() {
        console.error('RegisterParticipantEventListener Failed');
    });
  }

  initChat() {
      console.log('init chat');
      let self = this;
      this.vidyoConnector.RegisterMessageEventListener({
	        onChatMessageReceived: function(participant, chatMessage) {
               console.log('Chat msg got' + chatMessage);
               console.log(participant);
               console.log(chatMessage);
                self.getParticipantName(participant, function(name) {
                    console.log(name);
                    self.zone.run(() => {
                        self.cms.push ({p:name, msg:chatMessage.body})
                    });
                });               
            }
        }).then(function() {
	        console.log('RegisterParticipantEventListener Success');
        }).catch(function() {
	        console.error('RegisterParticipantEventListener Failed');
    });
  }

getParticipantName(participant, cb) {
    if (!participant) {
        cb('Undefined');
        return;
    }
    participant.GetName().then(function(name) {
        cb(name);
        console.log('Participant event ' + name);
    }).catch(function() {
        cb('GetNameFailed');
    });
}

setCamPrivacy(camp: boolean) {
    this.vidyoConnector.SetCameraPrivacy({
            privacy: camp,
        }).then(function() {
            if (camp) {
                //$('#cameraButton').addClass('cameraOff').removeClass('cameraOn');
                console.log('Cam off');
            } else {
                //$('#cameraButton').addClass('cameraOn').removeClass('cameraOff');
                console.log('Cam on');
            }
            console.log('SetCameraPrivacy Success');
        }).catch(function() {
            console.error('SetCameraPrivacy Failed');
        });
}

setMicPrivacy(micp: boolean) {
    this.vidyoConnector.SetMicrophonePrivacy({
            privacy: micp
        }).then(function() {
            if (micp) {
                console.log('micoff');
                //$('#microphoneButton').addClass('microphoneOff').removeClass('microphoneOn');
            } else {
                //$('#microphoneButton').addClass('microphoneOn').removeClass('microphoneOff');
            }
            console.log('SetMicrophonePrivacy Success');
        }).catch(function() {
            console.error('SetMicrophonePrivacy Failed');
        });
}
    enter(event) {
        console.log('enter');
        event.preventDefault();
        //this.connect();
    }
    exit(event) {
        console.log('exit');
        event.preventDefault();
        this.disconnect();
    }
    mute(event) {
        console.log('mute');
        event.preventDefault();
    }
    share(event) {
        console.log('share');
        event.preventDefault();
        //this.vidyoConnector.
    }
    sendchatmsg(msg: string) {
        console.log('send chat msg' + msg);
        event.preventDefault();
        if (this.vidyoConnector) {
            this.vidyoConnector.SendChatMessage(msg);
            this.cms.push ({p:"me", msg:msg})
        }
    }
}
