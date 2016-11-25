import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { HttpModule } from '@angular/http';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';

import { AUTH_PROVIDERS } from 'angular2-jwt';

import { AuthGuard } from './common/auth.guard';

import { Login } from './login';
import { Signup } from './signup';
import { App } from './app';
import { ForumRoom } from './forumroom';
import { PubForum } from './pubforum';

import { routes } from './app.routes';

@NgModule({
  bootstrap: [App],
  declarations: [
    Login, Signup, App, ForumRoom, PubForum
  ],
  imports: [
    HttpModule, BrowserModule, FormsModule,
    RouterModule.forRoot(routes, {
      useHash: true
    })
  ],
  providers: [
    AuthGuard, ...AUTH_PROVIDERS
  ]
})
export class AppModule {}
