import { getServerSession } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export function adminEmails(){return (process.env.ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);}
export function configured(){
  try{const u=new URL(process.env.NEXTAUTH_URL);return !!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.NEXTAUTH_SECRET?.length>=32&&adminEmails().length&&process.env.DATA_DIR&&(u.protocol==='https:'||(['localhost','127.0.0.1'].includes(u.hostname)&&u.protocol==='http:')));}catch{return false;}
}
export function allowedProfile(profile){
  const email=String(profile?.email||'').toLowerCase();
  const subjects=(process.env.ADMIN_GOOGLE_SUBS||'').split(',').map(s=>s.trim()).filter(Boolean);
  return !!(profile?.sub&&profile.email_verified===true&&adminEmails().includes(email)
    && (!subjects.length||subjects.includes(profile.sub))
    && (email.endsWith('@gmail.com')||profile.hd||subjects.includes(profile.sub)));
}
const Google=GoogleProvider.default||GoogleProvider;
export const authOptions={
  secret:process.env.NEXTAUTH_SECRET,
  providers:[Google({clientId:process.env.GOOGLE_CLIENT_ID||'',clientSecret:process.env.GOOGLE_CLIENT_SECRET||'',checks:['pkce','state'],authorization:{params:{scope:'openid email profile',prompt:'select_account'}}})],
  session:{strategy:'jwt',maxAge:60*60},
  pages:{signIn:'/admin',error:'/admin'},
  callbacks:{
    async signIn({account,profile}){return configured()&&account?.provider==='google'&&allowedProfile(profile);},
    async jwt({token,account,profile}){if(account&&profile){token.adminSub=profile.sub;token.email=profile.email.toLowerCase();}return token;},
    async session({session,token}){session.user={email:token.email,sub:token.adminSub};return session;},
    async redirect({url,baseUrl}){return url.startsWith('/')?baseUrl+url:new URL(url).origin===baseUrl?url:baseUrl+'/admin';}
  }
};
export async function requireAdmin(){
  if(!configured())throw Object.assign(new Error('관리자 로그인 설정이 필요합니다.'),{status:503});
  const session=await getServerSession(authOptions);
  if(!session?.user?.sub||!adminEmails().includes(session.user.email?.toLowerCase()))throw Object.assign(new Error('관리자 로그인이 필요합니다.'),{status:401});
  const subjects=(process.env.ADMIN_GOOGLE_SUBS||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(subjects.length&&!subjects.includes(session.user.sub))throw Object.assign(new Error('허용되지 않은 관리자입니다.'),{status:403});
  return session;
}
export function requireOrigin(request){
  const wanted=new URL(process.env.NEXTAUTH_URL).origin;
  if(request.headers.get('origin')!==wanted||request.headers.get('sec-fetch-site')==='cross-site')throw Object.assign(new Error('허용되지 않은 요청입니다.'),{status:403});
}
