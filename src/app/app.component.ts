import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { LocalStorageService } from 'angular-2-local-storage';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'Xahau Services';
  darkMode:boolean;

  constructor(private router: Router, private localStorage: LocalStorageService) { }

  getPageTitle(page_path:string): string {
    let title = "Xahau Services";

    switch(page_path) {
      case '': case '/': title = "Xahau Transactions"; break;
      case '/easy-iou': title = "Easy-IOU"; break;
      case '/tokens': title = "Xahau Tokens"; break;
      case '/tools': title = "Xahau Tools"; break;
      case '/terms': title = "Xahau Services Terms"; break;
      case '/privacy': title = "Xahau Services Privacy"; break;
      default: title = "Xahau Services"; break;
    }

    return title;
  }

  ngOnInit(){
    this.localStorage.remove("xrplAccount");
    this.localStorage.remove("testMode");
    let storageKeys:string[] = this.localStorage.keys();
    if(storageKeys && storageKeys.includes('darkMode')) {
      this.darkMode = this.localStorage.get("darkMode");
    }
    else {
      this.darkMode = true;
      this.localStorage.set("darkMode", this.darkMode);
    }
    
    var bodyStyles = document.body.style;
    if(this.darkMode) {
      bodyStyles.setProperty('--background-color', 'rgba(50, 50, 50)');
      //bodyStyles.setProperty('--dialog-background', 'rgba(50, 50, 50)');
      //bodyStyles.setProperty('--dialog-color', '#ffffff');
    }
    else {
        bodyStyles.setProperty('--background-color', 'rgba(238,238,238,.5)');
        //bodyStyles.setProperty('--dialog-background', 'rgba(238,238,238)');
        //bodyStyles.setProperty('--dialog-color', 'rgba(0, 0, 0)');
    }
    // always scroll to the top of the page on route change:
    this.router.events.subscribe(e => e instanceof NavigationEnd ? window.scrollTo(0,0) : null);
  }

  darkModeChanged(isDarkMode:boolean) {
    //console.log(isDarkMode);
    this.darkMode = isDarkMode;
    var bodyStyles = document.body.style;
    if(isDarkMode) {
        bodyStyles.setProperty('--background-color', 'rgba(50, 50, 50)');
        //bodyStyles.setProperty('--dialog-background', 'rgba(50, 50, 50)');
        //bodyStyles.setProperty('--dialog-color', '#ffffff');
        
    }
    else {
        bodyStyles.setProperty('--background-color', 'rgba(238,238,238,.5)');
        //bodyStyles.setProperty('--dialog-background', 'rgba(238,238,238)');
        //bodyStyles.setProperty('--dialog-color', 'rgba(0, 0, 0)');
    }
  }
}
