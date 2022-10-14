import { Routes, RouterModule } from '@angular/router';
import { ModuleWithProviders } from '@angular/core';
import { XrplTransactionsComponent } from './routes/xrpl-transactions';
import { Tools } from './routes/tools';
import { PrivacyComponent } from './routes/specific/privacy';
import { TermsComponent } from './routes/specific/terms';
import { Statistics } from './routes/statistics';

export const routes: Routes = [
    {path: '', component: XrplTransactionsComponent},
    {path: 'tools', component: Tools},
    {path: 'statistics', component: Statistics},
    {path: 'privacy', component: PrivacyComponent},
    {path: 'terms', component: TermsComponent},
    {path: '**', redirectTo: ''}
];

export const AppRoutes: ModuleWithProviders<any> = RouterModule.forRoot(routes, { relativeLinkResolution: 'legacy' });
