import {Injectable} from '@angular/core';
import {
  ApiResponseData,
  Cardinality,
  KnoraApiConfig,
  KnoraApiConnection,
  LoginResponse,
  LogoutResponse,
  ReadLinkValue,
  ReadOntology,
  ReadResource,
  ResourcePropertyDefinition,
  CountQueryResponse,
  ReadListValue,
  Constants,
  ReadTextValueAsString,
  ListAdminCache, ListResponse, ListNodeV2
} from "@knora/api";

import {AppInitService} from '../app-init.service';
import {BehaviorSubject, Observable, of} from "rxjs";
import {catchError, map} from 'rxjs/operators';
import {GravsearchTemplatesService} from "./gravsearch-templates.service";


/**
 * Data structures for properties from a resource (instance)
 */
export class PropertyData {
  constructor(public propname: string,
              public label: string,
              public values: Array<string>,
              public ids: Array<string>,
              public comments: Array<string | undefined>,
              public permissions: Array<string>) {}
}

export class ListPropertyData extends PropertyData {
  public nodeIris: Array<string>;

  constructor(propname: string,
              label: string,
              nodeIris: Array<string>,
              values: Array<string>,
              ids: Array<string>,
              comments: Array<string | undefined>,
              permissions: Array<string>) {
    super(propname, label, values, ids, comments, permissions);
    this.nodeIris = nodeIris;
  }
}

/**
 *  Data structure for representing a resource (instance)
 */
export interface ResourceData {
  id: string; /** Id (iri) of the resource */
  label: string; /** Label of the resource */
  permission: string; /** permission of the current user */
  properties: Array<PropertyData>; /** Array of properties with associated value(s) */
}

export interface LemmaData {
  id: string;
  label: string;
  permission: string; /** permission of the current user */
  properties: {[index: string]: {label: string, values: Array<string>}};
}

/**
 * Data structure representing the information about the property definitions of resource class
 */
export interface ResInfoProps {
  label?: string;
  cardinality: string;
  comment?: string;
  guiElement?: string;
  guiAttributes?: Array<string>;
  subjectType?: string;
  objectType?: string;
  isEditable?: boolean;
  isLinkProperty?: boolean;
  isLinkValueProperty?: boolean;
}

export interface ResInfo {
  id: string;
  label: string;
  comment: string;
  properties: {[index: string]: ResInfoProps};
}

@Injectable({
  providedIn: 'root'
})

export class KnoraService {
  knoraApiConnection: KnoraApiConnection;
  mlsOntology: string;
  loggedin: boolean;
  useremail: string;
  listAdminCache: ListAdminCache;

  // @ts-ignore
  private loggedinSubject = new BehaviorSubject<boolean>(false);
  public loggedinObs = this.loggedinSubject.asObservable();

  // this.appInitService.getSettings().server
  constructor(
    private appInitService: AppInitService,
    private queryTemplates: GravsearchTemplatesService
  ) {
    const protocol = this.appInitService.getSettings().protocol;
    const servername = this.appInitService.getSettings().servername;
    const port = this.appInitService.getSettings().port;
    const config = new KnoraApiConfig(protocol, servername, port, undefined, undefined, true);
    this.knoraApiConnection = new KnoraApiConnection(config);
    this.mlsOntology = appInitService.getSettings().ontologyPrefix + '/ontology/0807/mls/v2#';
    this.loggedin = false;
    this.useremail = '';
    this.listAdminCache = new ListAdminCache(this.knoraApiConnection.admin);
  }

  private processResourceProperties(data: ReadResource): Array<PropertyData> {
    const propdata: Array<PropertyData> = [];
    for (const prop in data.properties) {
      if (data.properties.hasOwnProperty(prop)) {
        switch (data.getValues(prop)[0].type) {
          case Constants.TextValue: {
            const vals = data.getValuesAs(prop, ReadTextValueAsString);
            const label: string = vals[0].propertyLabel || '?';
            const values: Array<string> = vals.map(v => v.text);
            const ids: Array<string> = vals.map(v => v.id);
            const comments: Array<string | undefined> = vals.map(v => v.valueHasComment);
            const permissions: Array<string> = vals.map(v => v.userHasPermission);
            propdata.push(new PropertyData(prop, label, values, ids, comments, permissions));
            break;
          }
          case Constants.ListValue: {
            const vals = data.getValuesAs(prop, ReadListValue);
            const label: string = vals[0].propertyLabel || '?';
            const values: Array<string> = vals.map(v => v.listNodeLabel);
            const nodeIris: Array<string> = vals.map(v => v.listNode);
            const ids: Array<string> = vals.map(v => v.id);
            const comments: Array<string | undefined> = vals.map(v => v.valueHasComment);
            const permissions: Array<string> = vals.map(v => v.userHasPermission);
            propdata.push(new ListPropertyData(prop, label, nodeIris, values, ids, comments, permissions));
            break;
          }
          case Constants.LinkValue: {
            const vals = data.getValuesAs(prop, ReadLinkValue);
            const label: string = vals[0].propertyLabel || '?';
            const values: Array<string> = vals.map(v => v.linkedResourceIri);
            //const nodeIris: Array<string> = vals.map(v => v.listNode);
            const ids: Array<string> = vals.map(v => v.id);
            const comments: Array<string | undefined> = vals.map(v => v.valueHasComment);
            const permissions: Array<string> = vals.map(v => v.userHasPermission);
            propdata.push(new PropertyData(prop, label, values, ids, comments, permissions));
            break;
          }
          default: {
            const vals = data.getValuesAs(prop, ReadTextValueAsString);
            const label: string = vals[0].propertyLabel || '?';
            const values: Array<string> = vals.map(v => v.text);
            const ids: Array<string> = vals.map(v => v.id);
            const comments: Array<string | undefined> = vals.map(v => v.valueHasComment);
            const permissions: Array<string> = vals.map(v => v.userHasPermission);
            propdata.push(new PropertyData(prop, label, values, ids, comments, permissions));
          }
        }
      }
    }
    return propdata;
  }

  private processSearchResult(datas: Array<ReadResource>, fields: Array<string>): Array<Array<string>> {
    const result: Array<Array<string>> = [];
    datas.map((data: ReadResource) => {
      const proparr: Array<string> = [];
      let idx: number;
      idx = fields.indexOf('arkUrl');
      if (idx > -1) {
        proparr[idx] = data.arkUrl;
      }
      idx = fields.indexOf('id');
      if (idx > -1) {
        proparr[idx] = data.id;
      }
      idx = fields.indexOf('label');
      if (idx > -1) {
        proparr[idx] = data.label;
      }
      for (const prop in data.properties) {
        if (data.properties.hasOwnProperty(prop)) {
          const index = fields.indexOf(prop);
          if (index > -1) {
            if (prop === 'http://api.knora.org/ontology/knora-api/v2#hasIncomingLinkValue') {
              const tmp = data.getValuesAs(prop, ReadLinkValue)[0];
              proparr[index] = tmp.linkedResourceIri;
            } else {
              proparr[index] = data.getValuesAsStringArray(prop)[0];
            }
          }
        }
      }
      result.push(proparr);
    });

    return result;
  }

  login(email: string, password: string): Observable<{success: boolean, token: string, user: string}> {
    return this.knoraApiConnection.v2.auth.login('email', email, password)
      .pipe(
        catchError((err) => {
          return of(err.error.response['knora-api:error']);
        }),
        map((response) => {
          if (response instanceof ApiResponseData) {
            const apiResponse = response as ApiResponseData<LoginResponse>;
            this.loggedin = true;
            this.useremail = email;
            this.loggedinSubject.next(true);
            return {success: true, token: apiResponse.body.token, user: email};
          } else {
            return {success: false, token: response, user: '-'};
          }
        }));
  }

  logout(): Observable<string> {
    return this.knoraApiConnection.v2.auth.logout().pipe(
      catchError((err) => {
        return of(err.error.response['knora-api:error']);
      }),
      map((response) => {
        if (response instanceof ApiResponseData) {
          const apiResponse = response as ApiResponseData<LogoutResponse>;
          this.loggedin = false;
          this.useremail = '';
          this.loggedinSubject.next(false);
          return apiResponse.body.message;
        } else {
          return response;
        }
      }));
  }

  getOntology(iri: string): Observable<ReadOntology> {
    return this.knoraApiConnection.v2.ontologyCache.getOntology(iri).pipe( // ToDo: Use cache
      map((cachedata: Map<string, ReadOntology>)  => cachedata.get(iri) as ReadOntology)
    );
  }

  getResinfo(ontoIri: string, resIri: string): Observable<ResInfo> {
    return this.knoraApiConnection.v2.ontologyCache.getOntology(ontoIri).pipe(  // ToDo: Use Cache
      map((cachedata: Map<string, ReadOntology>) => {
        const data = cachedata.get(ontoIri) as ReadOntology;
        const resInfo: ResInfo = {
          id: data.classes[resIri].id,
          comment: data.classes[resIri].comment ? data.classes[resIri].comment as string : '',
          label: data.classes[resIri].label ? data.classes[resIri].label as string : '',
          properties: {}
        };
        for (const prop of data.classes[resIri].propertiesList) {
          const propNamesParts = prop.propertyIndex.split('#');
          if ((propNamesParts[0] === "http://api.knora.org/ontology/knora-api/v2")
            || (propNamesParts[0] === "http://www.w3.org/2000/01/rdf-schema")) {
            continue;
          }
          let cardinalityStr: string = '';
          switch (prop.cardinality) {
            case Cardinality._1: cardinalityStr = '1'; break;
            case Cardinality._0_1: cardinalityStr = '0-1'; break;
            case Cardinality._0_n: cardinalityStr = '0-n'; break;
            case Cardinality._1_n: cardinalityStr = '1-n'; break;
          }
          const pdata = data.properties[prop.propertyIndex] as ResourcePropertyDefinition;
          const propInfo: ResInfoProps = {
            cardinality: cardinalityStr,
            label: pdata.label,
            comment: pdata.comment,
            subjectType: pdata.subjectType,
            objectType: pdata.objectType,
            guiElement: pdata.guiElement,
            guiAttributes: pdata.guiAttributes,
            isEditable: pdata.isEditable,
            isLinkProperty: pdata.isLinkProperty,
            isLinkValueProperty: pdata.isLinkValueProperty
          };
          resInfo.properties[prop.propertyIndex] = propInfo;
        }
        return resInfo;
      })
    );

  }

  getResource(iri: string): Observable<ResourceData> {
    return this.knoraApiConnection.v2.res.getResource(iri).pipe(
      map((data: ReadResource) => {
        return {
          id: data.id,
          label: data.label,
          permission: data.userHasPermission,
          properties: this.processResourceProperties(data)};
      }
    ));
  }

  gravsearchQueryCount(queryname: string, params: {[index: string]: string}): Observable<number> {
    params.ontology = this.appInitService.getSettings().ontologyPrefix;
    const query = this.queryTemplates[queryname](params);
    return this.knoraApiConnection.v2.search.doExtendedSearchCountQuery(query).pipe(
      map((data: CountQueryResponse) => {
        return data.numberOfResults;
      }));
  }

  gravsearchQuery(queryname: string, params: {[index: string]: string}, fields: Array<string>): Observable<Array<Array<string>>> {
    params.ontology = this.appInitService.getSettings().ontologyPrefix;
    const query = this.queryTemplates[queryname](params);
    return this.knoraApiConnection.v2.search.doExtendedSearch(query).pipe(
      map((data: Array<ReadResource>) => {
        return this.processSearchResult(data, fields);
      }));
  }

  private processLemmaProperties(data: ReadResource): {[index: string]: {label: string, values: Array<string>}} {
    const propdata: {[index: string]: {label: string, values: Array<string>}} = {};
    for (const prop in data.properties) {
      if (data.properties.hasOwnProperty(prop)) {
        const label: string = data.getValues(prop)[0].propertyLabel ? data.getValues(prop)[0].propertyLabel as string : '?';
        const values: Array<string> = data.getValuesAsStringArray(prop);
        propdata[prop] = {label: label, values: values};
      }
    }
    return propdata;
  }

  getLemma(iri: string): Observable<LemmaData> {
    return this.knoraApiConnection.v2.res.getResource(iri).pipe(
      map((data: ReadResource) => {
          return {id: data.id, label: data.label, permission: data.userHasPermission, properties: this.processLemmaProperties(data)};
        }
      ));
  }

  getListNode(iri: string): Observable<ListNodeV2> {
    return this.knoraApiConnection.v2.listNodeCache["getItem"](iri).pipe(
      map(data => data)
    );
  }

  getList(listIri: string): Observable<ListResponse> {
    return this.listAdminCache.getList(listIri).pipe(
      map( (res: ListResponse) => res)
    );
  }


}
