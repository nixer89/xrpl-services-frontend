import { Routes, RouterModule } from '@angular/router';
import { ModuleWithProviders } from '@angular/core';
import { XrplTransactionsComponent } from './routes/xrpl-transactions';
import { Tools } from './routes/tools';
import { GenericBackendDefinition } from './routes/generic-backend';
import { PrivacyComponent } from './routes/specific/privacy';
import { TermsComponent } from './routes/specific/terms';
import { EasyToken } from './routes/easyToken';

export const routes: Routes = [
    {path: '', component: XrplTransactionsComponent},
    {path: 'tools', component: Tools},
    {path: 'generic-backend', component: GenericBackendDefinition},
    {path: 'tokens', component: EasyToken},
    {path: 'privacy', component: PrivacyComponent},
    {path: 'terms', component: TermsComponent},
    {path: 'easy-iou', redirectTo: 'tokens'},
    {path: '**', redirectTo: ''}
];

export const AppRoutes: ModuleWithProviders = RouterModule.forRoot(routes, { relativeLinkResolution: 'legacy' });