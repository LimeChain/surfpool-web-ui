import { NhostClient } from '@nhost/nhost-js';

export const nhost = new NhostClient({
  authUrl: 'https://id.txtx.run/v1',
  graphqlUrl: 'https://id.gql.txtx.run/v1/graphql',
  storageUrl: 'https://coeemktozqwudjrkuddt.storage.us-east-1.nhost.run/v1',
  functionsUrl: 'https://coeemktozqwudjrkuddt.functions.us-east-1.nhost.run/v1',
});
