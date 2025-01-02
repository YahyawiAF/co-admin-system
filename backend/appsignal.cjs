// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Appsignal } = require('@appsignal/nodejs');

new Appsignal({
  active: true,
  name: 'collabora',
  pushApiKey: '802cb6bd-f4b3-4996-9e0b-8ea9cf47db6e',
});
