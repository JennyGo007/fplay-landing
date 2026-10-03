import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedProfile,requireOrigin,configured} from '../lib/auth.mjs';
test('Google allowlist requires verified email and optional stable identity',()=>{
  process.env.ADMIN_EMAILS='owner@gmail.com';delete process.env.ADMIN_GOOGLE_SUBS;
  assert.equal(allowedProfile({sub:'123',email:'owner@gmail.com',email_verified:true}),true);
  assert.equal(allowedProfile({sub:'123',email:'owner@gmail.com',email_verified:false}),false);
  assert.equal(allowedProfile({sub:'123',email:'other@gmail.com',email_verified:true}),false);
  process.env.ADMIN_GOOGLE_SUBS='456';assert.equal(allowedProfile({sub:'123',email:'owner@gmail.com',email_verified:true}),false);
  assert.equal(allowedProfile({sub:'456',email:'owner@gmail.com',email_verified:true}),true);
});
test('cross-origin and missing-origin mutation requests are denied',()=>{
  process.env.NEXTAUTH_URL='https://fplayground.com';
  assert.throws(()=>requireOrigin(new Request('https://fplayground.com/api/admin/save',{headers:{Origin:'https://evil.test'}})));
  assert.throws(()=>requireOrigin(new Request('https://fplayground.com/api/admin/save')));
  assert.doesNotThrow(()=>requireOrigin(new Request('https://fplayground.com/api/admin/save',{headers:{Origin:'https://fplayground.com'}})));
});
test('missing login credentials fail closed',()=>{delete process.env.GOOGLE_CLIENT_SECRET;assert.equal(configured(),false);});
