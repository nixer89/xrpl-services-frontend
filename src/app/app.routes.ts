import { Routes, RouterModule } from '@angular/router';
import { ModuleWithProviders } from '@angular/core';
import { XahauTransactionsComponent } from './routes/xahau-transactions';
import { Tools } from './routes/tools';
//import { GenericBackendDefinition } from './routes/generic-backend';
import { PrivacyComponent } from './routes/specific/privacy';
import { TermsComponent } from './routes/specific/terms';
import { EasyToken } from './routes/easyToken';
import { NftRoute } from './routes/nftRoute';
import { Statistics } from './routes/statistics';
import { XahauStatistics } from './routes/xahau-statistics';
import { NftApiBackend } from './routes/uritoken-api-backend';

export const routes: Routes = [
    {path: '', component: XahauTransactionsComponent},
    {path: 'tokens', component: EasyToken},
    {path: 'xls-14d', component: NftRoute},
    {path: 'tools', component: Tools},
    //{path: 'generic-backend', component: GenericBackendDefinition},
    {path: 'statistics', component: Statistics},
    {path: 'xahau-statistics', component: XahauStatistics},
    {path: 'uritoken-api', component: NftApiBackend},
    {path: 'privacy', component: PrivacyComponent},
    {path: 'terms', component: TermsComponent},
    {path: 'easy-iou', redirectTo: 'tokens'},
    {path: '**', redirectTo: ''}
];

export const AppRoutes: ModuleWithProviders<any> = RouterModule.forRoot(routes, { relativeLinkResolution: 'legacy' });
