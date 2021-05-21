import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {KnoraService, LemmaData} from '../../services/knora.service';
import {MatDialog, MatDialogConfig} from '@angular/material/dialog';
import {EditResourceComponent} from '../knora/edit-resource/edit-resource.component';
import {CreateResourceComponent} from '../knora/create-resource/create-resource/create-resource.component';
import {EditartComponent} from '../editart/editart.component';
import {EditlemComponent} from '../editlem/editlem.component';
import {ClipboardModule} from '@angular/cdk/clipboard';

@Component({
  selector: 'app-lemma',
  template: `
    <mat-card>
      <mat-card-title>
        {{ lemma.label }} <span
        *ngIf="lemma.properties[hasDeceasedValue] && (lemma.properties[hasDeceasedValue].values[0] == 'Ja')">†</span>
      </mat-card-title>
      <div *ngIf="lemma.properties[hasVariants]">
        {{ lemma.properties[hasVariants].label }}:
        <span *ngFor="let val of lemma.properties[hasVariants].values">{{ val }}</span>
      </div>
      <div *ngIf="lemma.properties[hasPseudonym]">
        {{ lemma.properties[hasPseudonym].label }}:
        <span *ngFor="let val of lemma.properties[hasPseudonym].values">{{ val }}</span>
      </div>
      <div>
        <span *ngIf="lemma.properties[hasStartDateInfo]">{{ lemma.properties[hasStartDateInfo].values[0] }}</span>
        <span *ngIf="lemma.properties[hasStartDate]"> {{ lemma.properties[hasStartDate].values[0] }}</span>
        <span *ngIf="lemma.properties[hasEndDateInfo]">, {{ lemma.properties[hasEndDateInfo].values[0] }}</span>
        <span *ngIf="lemma.properties[hasEndDate]"> {{ lemma.properties[hasEndDate].values[0] }}</span>
      </div>
      <div *ngIf="lemma.properties[hasViaf]">
        {{lemma.properties[hasViaf].label}}: <a href="http://viaf.org/viaf/{{ lemma.properties[hasViaf].values[0] }}"
                                                target="_blank">{{ lemma.properties[hasViaf].values[0] }}</a>
      </div>
      <div *ngIf="lemma.properties[hasGnd]">
        {{lemma.properties[hasGnd].label}}: <a href="http://d-nb.info/gnd/{{ lemma.properties[hasGnd].values[0] }}"
                                               target="_blank">{{ lemma.properties[hasGnd].values[0] }}</a>
      </div>
      <div style="padding-top: 10px;">
        ARK-ID: {{lemma.arkUrl}} &nbsp;
        <button mat-raised-button [cdkCopyToClipboard]="lemma.arkUrl" matTooltip="In Zwischenablage kopieren"><mat-icon>content_copy</mat-icon></button>
      </div>
      <mat-card-actions *ngIf="allowEdit">
        <button mat-raised-button (click)="editLemma()">Edit Lemma</button>
        <button mat-raised-button (click)="addArticle()">Add article</button>
      </mat-card-actions>
    </mat-card>
    <mat-card>
      <mat-card-title>
        In Lexika:
      </mat-card-title>
      <app-lex-from-lemma [lemmaIri]="lemmaIri">
      </app-lex-from-lemma>
    </mat-card>

  `,
  styles: [
    'td.mat-cell {padding-left: 10px; padding-right:20px;}',
    'tr.mat-row {height: 24px;}',
    '.clickable {cursor: pointer;}',
    '.full-width { width: 500px; font-size: 16px; }'
  ]
})

export class LemmaComponent implements OnInit {
  lemmaIri: string;
  lemma: LemmaData;
  private editPermissionSet: Set<string>;
  public allowEdit: boolean;

  hasLemmaDescription = this.knoraService.mlsOntology + 'hasLemmaDescription';
  hasLemmaComment = this.knoraService.mlsOntology + 'hasLemmaComment';
  hasDeceasedValue = this.knoraService.mlsOntology + 'hasDeceasedValue';
  hasEndDate = this.knoraService.mlsOntology + 'hasEndDate';
  hasEndDateInfo = this.knoraService.mlsOntology + 'hasEndDateInfo';
  hasFamilyName = this.knoraService.mlsOntology + 'hasFamilyName';
  hasGivenName = this.knoraService.mlsOntology + 'hasGivenName';
  hasLemmaText = this.knoraService.mlsOntology + 'hasLemmaText';
  hasLemmaType = this.knoraService.mlsOntology + 'hasLemmaType';
  hasStartDate = this.knoraService.mlsOntology + 'hasStartDate';
  hasStartDateInfo = this.knoraService.mlsOntology + 'hasStartDateInfo';
  hasViaf = this.knoraService.mlsOntology + 'hasViaf';
  hasGnd = this.knoraService.mlsOntology + 'hasGnd';
  hasVariants = this.knoraService.mlsOntology + 'hasVariants';
  hasPseudonym = this.knoraService.mlsOntology + 'hasPseudonym';


  constructor(public route: ActivatedRoute,
              public dialog: MatDialog,
              public knoraService: KnoraService,
              private router: Router) {
    this.lemma = {id: '', label: '', permission: '', arkUrl: '', properties: {}};
    this.editPermissionSet = new Set<string>(['M', 'D', 'CR']);
    this.allowEdit = false;
  }

  getLemma() {
    this.route.params.subscribe(params => {
      this.lemmaIri = params.iri;
      this.knoraService.getLemma(params.iri).subscribe((data) => {
        this.lemma = data;
        this.allowEdit = this.editPermissionSet.has(this.lemma.permission) && this.knoraService.loggedin;
      });
    });
  }

  getArk(): string {
    return this.lemma.arkUrl;
  }

  openEditDialog() {
    this.route.params.subscribe(params => {
      const editConfig = new MatDialogConfig();
      editConfig.autoFocus = true;
      editConfig.width = '800px';
      editConfig.data = {
        resIri: params.iri,
        resClassIri: this.knoraService.mlsOntology + 'Lemma'
      };
      const dialogRef = this.dialog.open(EditResourceComponent, editConfig);
    });

  }

  openEditLemmaDialog() {
    this.route.params.subscribe(params => {
      const createConfig = new MatDialogConfig();
      createConfig.autoFocus = true;
      createConfig.width = '800px';
      createConfig.data = {
        lemmaIri: this.lemma.id,
        lemmaLabel: this.lemma.label
      };
      const dialogRef = this.dialog.open(EditlemComponent, createConfig);

      dialogRef.afterClosed().subscribe(data => {
        if (data) {
          const tmp = this.lemmaIri.slice();
          this.lemmaIri = tmp;
        }
      });
    });
  }

  editLemma() {
    this.router.navigate(['/editlem',this.lemma.id]);
  }

  addArticle(): void {
    this.router.navigate(['/editart'], { queryParams: { lemma: this.lemma.id, label: this.lemma.label } });
  }

  ngOnInit() {
    this.getLemma();
  }

}
