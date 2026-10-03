import { requireAdmin,configured } from '../../lib/auth.mjs';
import Editor from './ui';
export const dynamic='force-dynamic';
export default async function Admin(){
  let session=null;try{session=await requireAdmin();}catch{}
  return <Editor email={session?.user?.email||null} enabled={configured()}/>;
}
