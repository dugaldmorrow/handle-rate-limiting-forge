import { ProductFetchOptions } from './ProductFetchOptions';

export class ProductFetchOptionsBuilder {

  private impersonation: 'app' | 'user';
  private api: 'jira' | 'confluence' | 'bitbucket';

  asApp = (): ProductFetchOptionsBuilder => {
    this.impersonation = 'app';
    return this;
  }

  // As per https://ecosystem.atlassian.net/browse/FRGE-805, the async events API does 
  // not yet support user contexts. Once it does, the following `asUser()` method will be
  // added.
  //
  // asUser = (): ProductFetchOptionsBuilder => {
  //   this.impersonation = 'user';
  //   return this;
  // }

  againstJira = (): ProductFetchOptionsBuilder => {
    this.api = 'jira';
    return this;
  }

  againstConfluence = (): ProductFetchOptionsBuilder => {
    this.api = 'confluence';
    return this;
  }

  againstBitbucket = (): ProductFetchOptionsBuilder => {
    this.api = 'bitbucket';
    return this;
  }

  build = (): ProductFetchOptions => {
    if (!this.impersonation) {
      throw new Error(`ProductFetchOptionsBuilder: No impersonation has been set.`);
    }
    if (!this.api) {
      throw new Error(`ProductFetchOptionsBuilder: No api has been set.`);
    }
    const productFetchOptions: ProductFetchOptions = {
      impersonation: this.impersonation,
      api: this.api
    }
    return productFetchOptions;
  }

}
