const nextConfig={
  poweredByHeader:false,
  async headers(){return [{source:'/:path*',headers:[
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
    {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
    {key:'Content-Security-Policy',value:"default-src 'self'; script-src 'self' 'unsafe-inline'"+(process.env.NODE_ENV==='development'?" 'unsafe-eval'":"")+"; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self'; font-src 'self'; connect-src 'self'; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self' https://accounts.google.com"}
  ]}];}
};
export default nextConfig;
