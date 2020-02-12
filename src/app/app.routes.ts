import { Routes, RouterModule } from '@angular/router';
import { ModuleWithProviders } from '@angular/core';
import { XrplTransactionsComponent } from './routes/xrpl-transactions';

export const routes: Routes = [
    {path: '', component: XrplTransactionsComponent},
    {path: 'xrpl-transactions', component: XrplTransactionsComponent},
];

export const AppRoutes: ModuleWithProviders = RouterModule.forRoot(routes);