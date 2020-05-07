import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { FlexLayoutModule } from '@angular/flex-layout';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutes } from './app.routes';

//my components
import { AppComponent } from './app.component';
import { TermsComponent } from './routes/specific/terms';
import { PrivacyComponent } from './routes/specific/privacy'
import { XrplTransactionsComponent } from './routes/xrpl-transactions';
import { Tools } from './routes/tools';
import { GenericBackendDefinition } from './routes/generic-backend';
import { EasyIOU } from './routes/easyIOU';
import { TopbarComponent } from './components/topbar';
import { FooterComponent } from './components/footer';
import { XummSignDialogComponent } from './components/xummSignRequestDialog';
import { GenericPayloadQRDialog } from './components/genericPayloadQRDialog';
import { EscrowList } from './components/escrowList/escrowList';
import { IouList } from './components/iouList/iouList';
import { TrustLineList } from './components/trustlineList/trustlineList';
import { TrustLineListIssuing } from './components/trustlineList/trustlineListIssuing';
import { CreateIOU } from './components/easyIOU/createIOU';
import { IssueMoreIOU } from './components/easyIOU/issueMoreIOU';

//XRPL transactions
import { AccountSetComponent } from './components/transactions/accountset';
import { EscrowCreateComponent } from './components/transactions/escrowcreate';
import { EscrowFinishComponent } from './components/transactions/escrowfinish';
import { EscrowCancelComponent } from './components/transactions/escrowcancel';
import { SetRegularKeyComponent } from './components/transactions/setregularkey';
import { SignerListSetComponent } from './components/transactions/signerlistset';
import { TrustSetComponent } from './components/transactions/trustset';

//Tools
import { NoRippleCheckComponent } from './components/tools/norippleCheck';

//Angular Material
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatNativeDateModule } from '@angular/material';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import { MatStepperModule } from '@angular/material/stepper';

//my services
import { AppService } from './services/app.service';
import { XummService } from './services/xumm.service';
import { GoogleAnalyticsService } from './services/google-analytics.service';

//special
import { DeviceDetectorModule } from 'ngx-device-detector';
import { ServiceWorkerModule } from '@angular/service-worker';
import { environment } from '../environments/environment';
import { LocalStorageModule } from 'angular-2-local-storage'

@NgModule({
  declarations: [
    AppComponent,
    TermsComponent,
    PrivacyComponent,
    XrplTransactionsComponent,
    Tools,
    GenericBackendDefinition,
    EasyIOU,
    TopbarComponent,
    FooterComponent,
    XummSignDialogComponent,
    GenericPayloadQRDialog,
    EscrowList,
    IouList,
    TrustLineList,
    TrustLineListIssuing,
    CreateIOU,
    IssueMoreIOU,
    AccountSetComponent,
    EscrowCreateComponent,
    EscrowFinishComponent,
    EscrowCancelComponent,
    SetRegularKeyComponent,
    SignerListSetComponent,
    TrustSetComponent,
    NoRippleCheckComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    AppRoutes,
    FlexLayoutModule,
    MatToolbarModule,
    MatExpansionModule,
    MatCardModule,
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatInputModule,
    FormsModule,
    ReactiveFormsModule,
    MatNativeDateModule,
    MatSlideToggleModule,
    MatIconModule,
    MatSnackBarModule,
    MatCheckboxModule,
    MatTableModule,
    MatPaginatorModule,
    MatMenuModule,
    MatStepperModule,
    //Special
    DeviceDetectorModule.forRoot(),
    ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production, registrationStrategy: 'registerImmediately' }),
    LocalStorageModule.forRoot({ prefix: 'XummCommunity', storageType: 'localStorage' }),
  ],
  entryComponents: [
    XummSignDialogComponent,
    GenericPayloadQRDialog
  ],
  providers: [
    AppService,
    XummService,
    GoogleAnalyticsService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
