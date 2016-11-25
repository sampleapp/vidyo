//MOVE SERVER INTEREACTION TO SERIVCE

import { Component, OnInit, OnDestroy, Input, NgZone } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/switchMap';
import { Jsonp, URLSearchParams } from '@angular/http';

import { Router,
         NavigationEnd, NavigationStart,
         ActivatedRoute, Params
      } from '@angular/router';

import { AuthHttp } from 'angular2-jwt';

const styles = require('./pubforum.css');
const template = require('./pubforum.html');
import { contentHeaders } from '../common/headers';


@Component({
  selector: 'home',
  template: template,
  styles: [ styles ]
})
export class PubForum implements OnInit {
  jwt: string;
  decodedJwt: string;
  response: string;
  api: string;
  values: string = '';
  @Input() rooms = [];
  userid: string;
  //server:string = "https://192.168.1.100:3001";
  server:string = "https://localhost:3001";

  constructor(public router: Router,
                public http: Http,
                public authHttp: AuthHttp,
                private zone: NgZone,
                private route: ActivatedRoute
              ) {
    this.jwt = localStorage.getItem('id_token');
    this.userid = localStorage.getItem('uid');
    this.decodedJwt = this.jwt && window.jwt_decode(this.jwt);
    console.log('buid pubform');
  }

  ngOnInit() {
    console.log('Init');
    console.log('iii'+this.rooms);
    let self = this;
     this.http.get(this.server + '/api/listroom', { headers: contentHeaders })
      .subscribe(
        response => {

          this.zone.run(() => {
                this.rooms = response.json();          
            });            
        },
        error => {
          alert(error.text());
          console.log(error.text());
        }
      );
  }
  ngOnDestory() {
      console.log('Destroy');
  }

  onKey(value: string) {
    this.values = value;
    console.log(this.values);
  }

  logout() {
    localStorage.removeItem('id_token');
    localStorage.removeItem('uid');
    this.router.navigate(['login']);
  }

  createRoom(roomName: string) {
      if (!roomName) {
            return;
      }
    let body = JSON.stringify({ roomName });
    console.log(body);
    this.http.post(this.server + '/api/addroom', body, { headers: contentHeaders })
      .subscribe(
        response => {
            this.rooms.push(response.json());
        },
        error => {
          alert(error.text());
          console.log(error.text());
        }
      );
   }

   findToken(rn: string) {
     for (let r  of this.rooms) {
        if (r.roomName === rn) {
          return r.token;
        }
     }
     return null;
   }


   join(event) {
    console.log('join');
    event.preventDefault();

    let roomName = event.srcElement.childNodes[0].data;
    console.log('Joining room:' + roomName+":");

    let user = localStorage.getItem('uid');
    if (!user) {
            user = 'Unauth';
    }

    let body = JSON.stringify({ user });
    this.http.post(this.server + '/api/token', body, { headers: contentHeaders })
      .subscribe(
        response => {
          let token = response.json().token;
          this.joinRoom(user, roomName, token);
        },
        error => {
          alert(error.text());
          console.log(error.text());
        }
    );
   }

   joinRoom(uid: string, roomName: string, token: string) {

        // let params = new URLSearchParams();    
        // params.set('id', roomName);
        // params.set('foo',"foo");

        let host = 'prod.vidyo.io';
        // //host: "sandbox.vidyo.io",
        let dn = uid;
        let rid = roomName;
        let params = {
            host: host,
            token: token,
            dn: dn,
            rid: rid
        };
        this.router.navigate(['/forumroom', params]);
        // this.router.navigate(['/forumroom', params]);        
    }
}
