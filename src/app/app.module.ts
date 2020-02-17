import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { FlexLayoutModule } from '@angular/flex-layout';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {AppRoutes} from './app.routes';

//my components
import { AppComponent } from './app.component';
import { TermsComponent } from './routes/specific/terms';
import { PrivacyComponent } from './routes/specific/privacy'
import { XrplTransactionsComponent } from './routes/xrpl-transactions';
import { TopbarComponent } from './components/topbar';
import { FooterComponent } from './components/footer';
import { XummSignDialogComponent } from './components/xummSignRequestDialog';
import { GenericPayloadQRDialog } from './components/genericPayloadQRDialog';

//XRPL transactions
import { AccountSetComponent } from './components/transactions/accountset';
import { EscrowCreateComponent } from './components/transactions/escrowcreate';
import { EscrowFinishComponent } from './components/transactions/escrowfinish';
import { EscrowCancelComponent } from './components/transactions/escrowcancel';

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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox'; 

//my services
import {AppService} from './services/app.service';
import {XummService} from './services/xumm.service';

//special
import { DeviceDetectorModule } from 'ngx-device-detector';

@NgModule({
  declarations: [
    AppComponent,
    TermsComponent,
    PrivacyComponent,
    XrplTransactionsComponent,
    TopbarComponent,
    FooterComponent,
    XummSignDialogComponent,
    GenericPayloadQRDialog,
    AccountSetComponent,
    EscrowCreateComponent,
    EscrowFinishComponent,
    EscrowCancelComponent
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
    MatDatepickerModule,
    MatNativeDateModule,
    MatSlideToggleModule,
    MatIconModule,
    MatSnackBarModule,
    MatCheckboxModule,
    //Special
    DeviceDetectorModule.forRoot()
  ],
  entryComponents: [
    XummSignDialogComponent,
    GenericPayloadQRDialog
  ],
  providers: [
    AppService,
    XummService,
    MatDatepickerModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
