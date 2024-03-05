import { Component, Inject, OnInit } from "@angular/core";
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { LocalStorageService } from '../services/local-storage.service';
import { OverlayContainer } from '@angular/cdk/overlay';

@Component({
    selector: "genericDialog",
    templateUrl: "genericDialog.html"
})
export class GenericDialogComponent implements OnInit{

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: any,
        public dialogRef: MatDialogRef<GenericDialogComponent>,
        private localStorage: LocalStorageService,
        private overlayContainer: OverlayContainer) {
    }

    line1:string = null;
    line2:string = null;
    btnLeft:string = null;
    btnRight:string = null;

    async ngOnInit() {
        if(this.localStorage && !this.localStorage.get("darkMode")) {
            this.overlayContainer.getContainerElement().classList.remove('dark-theme');
            this.overlayContainer.getContainerElement().classList.add('light-theme');
        } else {
            this.overlayContainer.getContainerElement().classList.remove('light-theme');
            this.overlayContainer.getContainerElement().classList.add('dark-theme');
        }
        
        this.line1 = this.data.line1;
        this.line2 = this.data.line2;
        this.btnLeft = this.data.btnLeft;
        this.btnRight = this.data.btnRight;
    }

    buttonLeftClicked() {
        this.dialogRef.close(true);
    }

    buttonRightClicked() {
        this.dialogRef.close(false);
    }
}