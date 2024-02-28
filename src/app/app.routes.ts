import { Routes, RouterModule } from '@angular/router';
import { ModuleWithProviders } from '@angular/core';
import { XrplTransactionsComponent } from './routes/xrpl-transactions';
import { Tools } from './routes/tools';
//import { GenericBackendDefinition } from './routes/generic-backend';
import { PrivacyComponent } from './routes/specific/privacy';
import { TermsComponent } from './routes/specific/terms';
import { EasyToken } from './routes/easyToken';
import { NftRoute } from './routes/nftRoute';
import { Statistics } from './routes/statistics';
import { XrplStatistics } from './routes/xrpl-statistics';
import { NftApiBackend } from './routes/nft-api-backend';

export const routes: Routes = [
    {path: '', component: XrplTransactionsComponent},
    {path: 'tokens', component: EasyToken},
    {path: 'xls-14d', component: NftRoute},
    {path: 'tools', component: Tools},
    //{path: 'generic-backend', component: GenericBackendDefinition},
    {path: 'statistics', component: Statistics},
    {path: 'xrpl-statistics', component: XrplStatistics},
    {path: 'nft-api', component: NftApiBackend},
    {path: 'privacy', component: PrivacyComponent},
    {path: 'terms', component: TermsComponent},
    {path: 'easy-iou', redirectTo: 'tokens'},
    {path: '**', redirectTo: ''}
];

export const AppRoutes: ModuleWithProviders<any> = RouterModule.forRoot(routes, {});
