import assert from 'node:assert/strict';
import test from 'node:test';

import axios from 'axios';

import { NatureRemoApi } from '../dist/natureRemoApi.js';

class TestHapStatusError extends Error {
  constructor(hapStatus) {
    super(`HAP status ${hapStatus}`);
    this.hapStatus = hapStatus;
  }
}

const HAPStatus = {
  INSUFFICIENT_AUTHORIZATION: -70411,
  RESOURCE_BUSY: -70403,
  RESOURCE_DOES_NOT_EXIST: -70409,
  SERVICE_COMMUNICATION_FAILURE: -70402,
};

function createApi(client) {
  axios.create = () => client;
  const messages = [];
  const logger = {
    error: (...args) => messages.push(args),
  };
  const homebridgeApi = {
    hap: {
      HapStatusError: TestHapStatusError,
      HAPStatus,
    },
  };
  return {
    api: new NatureRemoApi(logger, homebridgeApi, 'test-token'),
    messages,
  };
}

test('device responses are cached within the cache window', async () => {
  let requests = 0;
  const devices = [{ id: 'remo-1', newest_events: {} }];
  const { api } = createApi({
    get: async () => {
      requests += 1;
      return { data: devices };
    },
  });

  assert.equal(await api.getAllDevices(), devices);
  assert.equal(await api.getAllDevices(), devices);
  assert.equal(requests, 1);
});

test('successful commands await the request and invalidate the appliance cache', async () => {
  let requests = 0;
  let posted;
  const appliances = [{ id: 'light-1', type: 'LIGHT', light: { state: { power: 'off' } } }];
  const { api } = createApi({
    get: async () => {
      requests += 1;
      return { data: appliances };
    },
    post: async (url, body) => {
      posted = { url, body };
    },
  });

  await api.getAllAppliances();
  await api.setLight('light-1', 'on');
  await api.getAllAppliances();

  assert.equal(requests, 2);
  assert.deepEqual(posted, {
    url: '/appliances/light-1/light',
    body: 'button=on',
  });
});

test('unexpected successful responses become HomeKit communication errors', async () => {
  const { api, messages } = createApi({
    get: async () => ({ data: { error: 'unexpected' } }),
  });

  await assert.rejects(
    api.getAllDevices(),
    error => error instanceof TestHapStatusError
      && error.hapStatus === HAPStatus.SERVICE_COMMUNICATION_FAILURE,
  );
  assert.equal(messages.length, 1);
});

test('authorization and rate-limit errors use specific HomeKit status codes', async () => {
  const unauthorized = createApi({
    get: async () => {
      throw { response: { status: 401, headers: {} } };
    },
  });
  await assert.rejects(
    unauthorized.api.getAllDevices(),
    error => error.hapStatus === HAPStatus.INSUFFICIENT_AUTHORIZATION,
  );

  const rateLimited = createApi({
    get: async () => {
      throw { response: { status: 429, headers: {} } };
    },
  });
  await assert.rejects(
    rateLimited.api.getAllDevices(),
    error => error.hapStatus === HAPStatus.RESOURCE_BUSY,
  );
});
