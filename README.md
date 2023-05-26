# handle-rate-limiting-forge

The repo contains code to help Forge apps handle rate limiting REST API responses when invoked from Forge functions.

# Getting started

```
yarn add handle-rate-limiting-js
yarn add handle-rate-limiting-forge
```

# Example code

## manifest.yml - Forge manifest

Your manifest needs to declare a queue and function entry points that the library will use
for retrying API requests using the Forge Async Events API.

```
modules:
  jira:projectPage:
    - key: forge-rate-limiting-demo-hello-world-project-page
      function: project-page-fn
      title: Forge rate limiting demo
  consumer:
    - key: test-consumer
      queue: rest-retry-queue
      resolver:
        function: rest-retry-fn
        method: rest-retry-listener
  function:
    - key: project-page-fn
      handler: index.run
    - key: rest-retry-fn
      handler: index.restRetryHandler
permissions:
  scopes:
    - storage:app
    - read:jira-work
app:
  id: ari:cloud:ecosystem::app/xxxxxxx
```

## index.ts

Based on the above manifest, the following code provides a simple user interface to trigger the API request. 

```
import ForgeUI, {
  Button,
  ProjectPage,
  Fragment,
  Text,
  render,
  useProductContext,
  JiraContext
} from '@forge/ui';
import { APIResponse } from '@forge/events/out/types';
import {
  nonUiContextRateLimitingHandlingOptionsDefaults
} from 'handle-rate-limiting-js';
import {
  AsyncFetchManager,
  AsyncRetryInfo,
  MockRetryDetector,
  ProductFetchOptions,
  ProductFetchOptionsBuilder
} from 'handle-rate-limiting-forge';

interface MyAppContext {
  foo: string
  requestStartTime: number
}

/**
 * This method is responsible for handling the response if it available.
 */
const maybeHandleProductResponse = async (response: APIResponse, appContextString: string): Promise<void> => {
  console.log(`We got a response which means the request has completed and should be processed.`);
  if (response.status === 200) {
    console.log(`AWESOME - it looks like the request was successul.`);
    const appContext = JSON.parse(appContextString) as MyAppContext;
    console.log(`          and I have access to my app context:\n${JSON.stringify(appContext, null, 2) }`);
    // console.log(JSON.stringify(JSON.parse(appContext), null, 2));
    console.log(`Request duration = ${(new Date().getTime() - appContext.requestStartTime)/1000} seconds`);
  } else {
    console.log(`BUMMER - it looks like the request was unsuccessul.`);
  }
}

const queueName = 'rest-retry-queue';
const retryListenerName = 'rest-retry-listener';
const asyncFetchManager = new AsyncFetchManager(
  queueName,
  retryListenerName,
  maybeHandleProductResponse);
export const restRetryHandler = asyncFetchManager.getQueueHandler();

// Inject a retry detector that will force retries for demonstration purposes.
asyncFetchManager.setRetryDetector(new MockRetryDetector());

const invokeApi = async (): Promise<void> => {
  const context = useProductContext();
  console.log(`Context = ${JSON.stringify(context, null, 2)}`);
  const projectKey = context.platformContext ? (context.platformContext as JiraContext).projectKey : undefined;
  const stringRoute = `/rest/api/3/search`;
  const payload = {
    expand: [
      "names",
      "schema",
      "operations"
    ],
    fields: [
      "summary",
      "status",
      "assignee"
    ],
    fieldsByKeys: false,
    jql: `project = ${projectKey}`,
    startAt: 0
  };
  const init = {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }
  const productFetchOptions: ProductFetchOptions = new ProductFetchOptionsBuilder()
    // When https://ecosystem.atlassian.net/browse/FRGE-805 is implemented, we should
    // test with `.asUser()`.
    .asApp()
    // .asUser()
    .againstJira()
    .build();
  const appContext: MyAppContext = {
    foo: 'bar',
    requestStartTime: new Date().getTime()
  }
  const asyncRetryInfo: AsyncRetryInfo = {
    remainingRetries: 2,
    retryDelayMillis: 1000,
    productFetchOptions: productFetchOptions,
    rateLimitingHandlingOptions: nonUiContextRateLimitingHandlingOptionsDefaults,
    stringRoute: stringRoute,
    init: init,
    appContext: JSON.stringify(appContext)
  }
  await asyncFetchManager.productFetch(asyncRetryInfo);
}

const App = () => {
  return (
    <Fragment>
      <Text>Forge rate limiting demo</Text>
      <Button
        text="Invoke an API"
        onClick={async () => {
          await invokeApi();
        }}
      />
    </Fragment>
  );
};

export const run = render(
  <ProjectPage>
    <App />
  </ProjectPage>
);
```
