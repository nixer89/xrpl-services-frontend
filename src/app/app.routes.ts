import { Routes, RouterModule } from '@angular/router';
import { ModuleWithProviders } from '@angular/core';
import { XrplTransactionsComponent } from './routes/xrpl-transactions';
import { TransactionScheduler } from './routes/transaction-scheduler';
import { GenericBackendDefinition } from './routes/generic-backend';
import { PrivacyComponent } from './routes/specific/privacy';
import { TermsComponent } from './routes/specific/terms';

export const routes: Routes = [
    {path: '', component: XrplTransactionsComponent},
    {path: 'scheduler', component: TransactionScheduler},
    {path: 'generic-backend', component: GenericBackendDefinition},
    {path: 'privacy', component: PrivacyComponent},
    {path: 'terms', component: TermsComponent},
    {path: '**', redirectTo: ''}
];

export const AppRoutes: ModuleWithProviders = RouterModule.forRoot(routes);