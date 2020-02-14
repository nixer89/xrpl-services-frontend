import { Component, OnInit } from '@angular/core';
import { version } from '../../../package.json'

@Component({
  selector: 'app-footer',
  templateUrl: './footer.html'
})
export class FooterComponent implements OnInit {

  public appVersion:string = version;

  constructor() { }

  ngOnInit() {
  }

}
