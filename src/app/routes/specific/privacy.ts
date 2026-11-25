import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Title } from '@angular/platform-browser';

@Component({
    selector: 'privacy',
    templateUrl: 'privacy.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})

export class PrivacyComponent implements OnInit {

  constructor(private titleService: Title) {}

  ngOnInit() {
    this.titleService.setTitle("Xahau Services Privacy");
  }
}
