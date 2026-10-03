import NextAuth from 'next-auth';
import { authOptions,configured } from '../../../../lib/auth.mjs';
export const runtime='nodejs';
const handler=NextAuth(authOptions);
async function guarded(req,context){
  if(!configured())return Response.json({error:'관리자 로그인 설정이 필요합니다.'},{status:503});
  return handler(req,context);
}
export {guarded as GET,guarded as POST};
