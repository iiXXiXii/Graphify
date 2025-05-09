import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'Graphify - Home'
  },
  // Redirect all unknown paths to the home page
  {
    path: '**',
    redirectTo: ''
  }
];
