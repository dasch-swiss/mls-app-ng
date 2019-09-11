import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { KnoraResource, KnoraValue } from 'knora-jsonld-simplify';
import { ActivatedRoute } from '@angular/router';
import { ElementRef, ViewChild } from '@angular/core';
import { Router} from '@angular/router';
import { KnoraApiService } from '../../services/knora-api.service';

@Component({
  selector: 'app-lemmata',
  template: `
    <mat-card *ngIf="lexicon_iri">
        <mat-card-title>
            <app-lexicon [lexiconIri]="lexicon_iri"></app-lexicon>
        </mat-card-title>
    </mat-card>
    <mat-card>
      <mat-card-title>
        Lemmata
      </mat-card-title>
      <mat-card-content>
        <form (submit)="searchEvent($event)" (keyup.enter)="searchEvent($event)">
          <mat-form-field>
            <input #searchField
                   name="searchterm"
                   [value]="searchterm"
                   matInput
                   type="search"
                   placeholder="Suchbegriff für Lemma" />
            <mat-icon matSuffix class="clickable" (click)="searchEvent($event)">search</mat-icon>
            <mat-icon matSuffix class="clickable" (click)="searchCancel($event)">cancel</mat-icon>
            <mat-hint>Suche in Lemma, Pseudonyms etc.</mat-hint>
          </mat-form-field>
        </form>
        <app-aindex *ngIf="showAindex" [activeChar]="startchar" (charChange)='charChanged($event)'></app-aindex>
        <mat-progress-bar mode="indeterminate" *ngIf="showProgbar"></mat-progress-bar>
        <table mat-table [dataSource]="lemmata">
          <ng-container matColumnDef="lemma_text">
            <th mat-header-cell *matHeaderCellDef> Lemma </th>
            <td mat-cell *matCellDef="let element"> {{element.lemma_text}} </td>
          </ng-container>
          <ng-container matColumnDef="lemma_start">
            <th mat-header-cell *matHeaderCellDef> Start </th>
            <td mat-cell *matCellDef="let element"> {{element.lemma_start}} </td>
          </ng-container>
          <ng-container matColumnDef="lemma_end">
            <th mat-header-cell *matHeaderCellDef> End </th>
            <td mat-cell *matCellDef="let element"> {{element.lemma_end}} </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columnsToDisplay"></tr>
          <tr mat-row *matRowDef="let row; columns: columnsToDisplay;" (click)="lemmaSelected(row)"></tr>
        </table>

        <mat-paginator *ngIf="nLemmata > 25" [length]="nLemmata"
                       [pageIndex]="page"
                       [pageSize]="25"
                       [pageSizeOptions]="[25]"
                       (page)="pageChanged($event)" showFirstLastButtons>
        </mat-paginator>

      </mat-card-content>
    </mat-card>
  `,
  styles: [
    'td.mat-cell {padding-left: 10px; padding-right:20px;}',
    'tr.mat-row {height: 24px;}',
    '.clickable {cursor: pointer;}'
  ]
})

export class LemmataComponent implements OnInit {
  @ViewChild('searchField', {static: false})
  private searchField: ElementRef;

  lemmata: Array<{[index: string]: string}> = [];
  startchar: string;
  page: number;
  nLemmata: number;
  columnsToDisplay: Array<string> = ['lemma_text', 'lemma_start', 'lemma_end'];
  showProgbar: boolean = false;
  showAindex: boolean = true;
  searchterm: string;
  lexicon_iri: string ='';

  constructor(private knoraApiService: KnoraApiService,
              private activatedRoute: ActivatedRoute,
              private elementRef: ElementRef,
              private router: Router) {
    this.startchar = 'A';
    this.page = 0;
    this.searchterm = '';
    this.activatedRoute.queryParams.subscribe(params => {
      this.startchar = params.hasOwnProperty('startchar') ? params.startchar : 'A';
      console.log('STARTCHAR=' + this.startchar); // Print the parameter to the console.
      this.lexicon_iri = params.hasOwnProperty('lexicon_iri') ? params.lexicon_iri : undefined;
      console.log('LEXICON_IRI=' + this.lexicon_iri);
    });
  }

  charChanged(c: string): void {
    this.startchar = c;
    this.page = 0;
    this.router.navigate(
      [],
      {
        relativeTo: this.activatedRoute,
        queryParams: {page: this.page, startchar: this.startchar},
        queryParamsHandling: "merge", // remove to replace all query params by provided
      });
    console.log(c);
    this.getLemmata();
  }

  pageChanged(event): void {
    this.page = event.pageIndex;
    this.router.navigate(
      [],
      {
        relativeTo: this.activatedRoute,
        queryParams: {page: this.page},
        queryParamsHandling: "merge", // remove to replace all query params by provided
      });
    if (this.searchterm === '' && this.lexicon_iri === '') {
      this.getLemmata();
    } else {
      this.searchLemmata();
    }
  }

  lemmaSelected(event): void {
    const url = 'lemma/' + encodeURIComponent(event.lemma_iri);
    this.router.navigateByUrl(url).then(e => {
      if (e) {
        console.log("Navigation is successful!");
      } else {
        console.log("Navigation has failed!");
      }
    });
  }

  getLemmata(): void {
    this.showProgbar = true;
    this.lemmata = [];
    const paramsCnt = {
      page: '0',
      start: this.startchar
    };
    this.knoraApiService.gravsearchQueryCount('lemmata_query', paramsCnt)
      .subscribe(n => (this.nLemmata = Number(n)));
    const params = {
      page: String(this.page),
      start: this.startchar
    };
    this.knoraApiService.gravsearchQuery('lemmata_query', params)
      .subscribe((data: Array<KnoraResource>) => {
        this.lemmata = data.map((x) => {
          const lemmaText = x ? x.getValue('mls:hasLemmaText') : undefined;
          const lemmaStart = x ? x.getValue('mls:hasStartDate') : undefined;
          const lemmaEnd = x ? x.getValue('mls:hasEndDate') : undefined;
          const lemmaIri = x ? x.iri : undefined;
          this.showProgbar = false;
          return {
            lemma_text: lemmaText ? lemmaText.strval : '-',
            lemma_start: lemmaStart ? lemmaStart.strval : '?',
            lemma_end: lemmaEnd ? lemmaEnd.strval : '?',
            lemma_iri: lemmaIri ? lemmaIri : 'http://NULL'
          };
        });
      });
  }

  searchLemmata(): void {
    this.showProgbar = true;
    this.showAindex = false;
    this.lemmata = [];

    const paramsCnt: {[index: string]: string} = {
      page: '0',
      searchterm: this.searchterm
    };
    if (this.lexicon_iri !== '') {
      paramsCnt.lexicon_iri = this.lexicon_iri;
    }
    console.log(paramsCnt);
    this.knoraApiService.gravsearchQueryCount('lemmata_search', paramsCnt)
      .subscribe(n => (this.nLemmata = Number(n)));

    const params: {[index: string]: string} = {
      page: String(this.page),
      searchterm: this.searchterm
    };
    if (this.lexicon_iri !== '') {
      params.lexicon_iri = this.lexicon_iri;
    }
    console.log(params);
    this.knoraApiService.gravsearchQuery('lemmata_search', params)
      .subscribe((data: Array<KnoraResource>) => {
        this.lemmata = data.map((x) => {
          const lemmaText = x ? x.getValue('mls:hasLemmaText') : undefined;
          const lemmaStart = x ? x.getValue('mls:hasStartDate') : undefined;
          const lemmaEnd = x ? x.getValue('mls:hasEndDate') : undefined;
          const lemmaIri = x ? x.iri : undefined;
          this.showProgbar = false;
          return {
            lemma_text: lemmaText ? lemmaText.strval : '-',
            lemma_start: lemmaStart ? lemmaStart.strval : '?',
            lemma_end: lemmaEnd ? lemmaEnd.strval : '?',
            lemma_iri: lemmaIri ? lemmaIri : 'http://NULL'
          };
        });
      });
  }

  searchEvent(event): boolean {
    this.searchterm = this.searchField.nativeElement.value;
    this.page = 0;
    this.searchLemmata();
    return false;
  }

  searchCancel(event): void {
    this.searchterm = '';
    this.showAindex = true;
    this.getLemmata();
  }

  ngOnInit() {
    this.activatedRoute.queryParams.subscribe(params => {
      if (params.hasOwnProperty('searchterm')) {
        this.searchterm = params.searchterm;
        console.log('SEARCHTERM: ' + params.searchterm); // Print the parameter to the console.
      } else if (params.hasOwnProperty('startchar')) {
        this.startchar = params.hasOwnProperty('startchar') ? params.startchar : 'A';
        console.log('STARTCHAR: ' + this.startchar); // Print the parameter to the console.
      } else if (params.hasOwnProperty('page')) {
        this.page = Number(params.hasOwnProperty('startchar'));
        console.log('PAGE: ' + this.page); // Print the parameter to the console.
      }
      if (this.searchterm !== '' || this.lexicon_iri !=='') {
        this.page = 0;
        this.searchLemmata();
      } else {
        this.getLemmata();
      }
    });
  }

}
