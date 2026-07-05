import { rolesFromAccessToken, userFromAccessToken } from './jwt-claims';

describe('jwt-claims', () => {
  const token = [
    btoa(JSON.stringify({ alg: 'none', typ: 'JWT' })),
    btoa(
      JSON.stringify({
        sub: 'user-42',
        email: 'u@example.com',
        name: 'User',
        roles: ['Admin'],
      }),
    ),
    '',
  ].join('.');

  it('extracts normalized roles from access token', () => {
    expect(rolesFromAccessToken(token)).toEqual(['admin']);
  });

  it('builds user from access token claims', () => {
    expect(userFromAccessToken(token)).toEqual({
      sub: 'user-42',
      email: 'u@example.com',
      name: 'User',
      roles: ['admin'],
    });
  });
});
