import { Routes, RouterModule } from '@angular/router';
import { ModuleWithProviders } from '@angular/core';
import { XrplTransactionsComponent } from './routes/xrpl-transactions';
import { PrivacyComponent } from './routes/specific/privacy';
import { TermsComponent } from './routes/specific/terms';

export const routes: Routes = [
    {path: '', component: XrplTransactionsComponent},
    {path: 'privacy', component: PrivacyComponent},
    {path: 'terms', component: TermsComponent},
];

export const AppRoutes: ModuleWithProviders = RouterModule.forRoot(routes);