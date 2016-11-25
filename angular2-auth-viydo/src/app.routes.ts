import { Routes } from '@angular/router';

import { Login } from './login';
import { Signup } from './signup';
import { ForumRoom } from './forumroom';
import { PubForum } from './pubforum';
import { AuthGuard } from './common/auth.guard';

export const routes: Routes = [
  { path: '',       component: Login },
  { path: 'login',  component: Login },
  { path: 'signup', component: Signup },
  { path: 'pubroom', component: PubForum, canActivate: [AuthGuard] },
  { path: 'forumroom',   component: ForumRoom, canActivate: [AuthGuard] },
  //{ path: 'pubforum', component: PubForum },
  //{ path: 'forumroom',   component: ForumRoom },
  { path: '**',     component: Login },
];
