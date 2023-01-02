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
import { EasyToken } from './routes/easyToken';
import { NftRoute } from './routes/nftRoute';
import { TopbarComponent } from './components/topbar';
import { FooterComponent } from './components/footer';
import { XummSignDialogComponent } from './components/xummSignRequestDialog';
import { GenericPayloadQRDialog } from './components/genericPayloadQRDialog';
import { GenericDialogComponent } from './components/genericDialog';
import { EscrowList } from './components/escrowList/escrowList';
import { EscrowListExecuter } from './components/escrowListExecuter/escrowListExecuter';
import { TokenList } from './components/tokenList/tokenList';
import { TrustLineList } from './components/trustlineList/trustlineList';
import { TrustLineListIssuing } from './components/trustlineList/trustlineListIssuing';
import { CreateToken } from './components/easyToken/createToken';
import { IssueMoreToken } from './components/easyToken/issueMoreToken';
import { IssuedTokenList } from './components/easyToken/issuedTokenList';
import { IssuedNftList } from './components/easyToken/issuedNftList';
import { TokenDetailsDialog } from './components/easyToken/tokenDetailsDialog';
import { BlackholeAccount } from './components/easyToken/blackholeAccount';

//XRPL transactions
import { AccountSetComponent } from './components/transactions/accountset';
import { EscrowCreateComponent } from './components/transactions/escrowcreate';
import { EscrowFinishComponent } from './components/transactions/escrowfinish';
import { EscrowCancelComponent } from './components/transactions/escrowcancel';
import { SetRegularKeyComponent } from './components/transactions/setregularkey';
import { SignerListSetComponent } from './components/transactions/signerlistset';
import { TrustSetComponent } from './components/transactions/trustset';
import { AccountDeleteComponent } from './components/transactions/accountdelete';

//Tools
import { NoRippleCheckComponent } from './components/tools/norippleCheck';
import { RawTransactionsComponent } from './components/tools/rawTransactions';
import { TestNetCredentialsComponent } from './components/tools/testNetCredentials';
import { TransactionSchedulerComponent } from './components/tools/transactionScheduler';
import { MultiSignFlowComponent } from './components/tools/multiSignFlow';
import { UnlCheckerComponent } from './components/tools/unlChecker';

//Statistics
import { Statistics } from './routes/statistics';
import { XrplStatistics } from './routes/xrpl-statistics';

//NFT API
import { NftApiBackend } from './routes/nft-api-backend';

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
import { MatNativeDateModule } from '@angular/material/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import { MatStepperModule } from '@angular/material/stepper';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatMomentDateModule } from '@angular/material-moment-adapter';

//my services
import { AppService } from './services/app.service';
import { XummService } from './services/xumm.service';
import { UtilService } from './services/util.service';
import { GoogleAnalyticsService } from './services/google-analytics.service';
import { XRPLWebsocket } from './services/xrplWebSocket';

//special
import { DeviceDetectorService } from 'ngx-device-detector';
import { LocalStorageModule } from 'angular-2-local-storage';
import { CodemirrorModule } from '@ctrl/ngx-codemirror';
import { HighlightSearchPipe } from './utils/searchHighlight';

@NgModule({
  declarations: [
    AppComponent,
    TermsComponent,
    PrivacyComponent,
    XrplTransactionsComponent,
    Tools,
    GenericBackendDefinition,
    EasyToken,
    NftRoute,
    TopbarComponent,
    FooterComponent,
    XummSignDialogComponent,
    GenericPayloadQRDialog,
    GenericDialogComponent,
    EscrowList,
    EscrowListExecuter,
    TokenList,
    TrustLineList,
    TrustLineListIssuing,
    CreateToken,
    IssueMoreToken,
    IssuedTokenList,
    AccountSetComponent,
    EscrowCreateComponent,
    EscrowFinishComponent,
    EscrowCancelComponent,
    SetRegularKeyComponent,
    SignerListSetComponent,
    TrustSetComponent,
    NoRippleCheckComponent,
    TransactionSchedulerComponent,
    BlackholeAccount,
    AccountDeleteComponent,
    RawTransactionsComponent,
    TestNetCredentialsComponent,
    MultiSignFlowComponent,
    HighlightSearchPipe,
    Statistics,
    XrplStatistics,
    TokenDetailsDialog,
    IssuedNftList,
    UnlCheckerComponent,
    NftApiBackend
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
    MatSelectModule,
    MatSortModule,
    MatChipsModule,
    CodemirrorModule,
    MatDatepickerModule,
    MatMomentDateModule,
    //Special
    LocalStorageModule.forRoot({ prefix: 'XrplServices', storageType: 'localStorage', notifyOptions: {setItem: true, removeItem: false} }),
  ],
  providers: [
    AppService,
    XummService,
    UtilService,
    GoogleAnalyticsService,
    XRPLWebsocket,
    DeviceDetectorService,
    MatMomentDateModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
