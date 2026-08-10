import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ErrorCode } from '../common/constants/error-codes';
import { Role, User } from '../generated/prisma/client';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    name: 'Pravin Pagare',
    email: 'pravin@example.com',
    passwordHash: '',
    role: Role.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
}

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: {
    findByEmail: jest.Mock<Promise<User | null>, [string]>;
    create: jest.Mock<Promise<User>, [CreateUserInput]>;
  };
  let jwtService: { sign: jest.Mock<string, [Record<string, unknown>]> };

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn<Promise<User | null>, [string]>(),
      create: jest.fn<Promise<User>, [CreateUserInput]>(),
    };
    jwtService = {
      sign: jest
        .fn<string, [Record<string, unknown>]>()
        .mockReturnValue('signed.jwt.token'),
    };
    authService = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
    );
  });

  describe('register', () => {
    it('rejects an email that is already registered', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser());

      await expect(
        authService.register({
          name: 'Someone',
          email: 'pravin@example.com',
          password: 'Str0ngPass!',
        }),
      ).rejects.toMatchObject({
        code: ErrorCode.EMAIL_ALREADY_REGISTERED,
      });
    });

    it('hashes the password before storing the user', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockImplementation((data: { passwordHash: string }) =>
        Promise.resolve(buildUser({ passwordHash: data.passwordHash })),
      );

      await authService.register({
        name: 'Pravin Pagare',
        email: 'pravin@example.com',
        password: 'Str0ngPass!',
      });

      const [{ passwordHash }] = usersService.create.mock.calls[0];
      expect(passwordHash).not.toBe('Str0ngPass!');
      await expect(bcrypt.compare('Str0ngPass!', passwordHash)).resolves.toBe(
        true,
      );
    });

    it('returns a signed access token and the sanitized user', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(buildUser());

      const result = await authService.register({
        name: 'Pravin Pagare',
        email: 'pravin@example.com',
        password: 'Str0ngPass!',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user.email).toBe('pravin@example.com');
    });
  });

  describe('login', () => {
    it('rejects an unknown email without revealing whether it exists', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nobody@example.com',
          password: 'whatever1',
        }),
      ).rejects.toMatchObject({
        code: ErrorCode.INVALID_CREDENTIALS,
      });
    });

    it('rejects an incorrect password', async () => {
      const passwordHash = await bcrypt.hash('Str0ngPass!', 4);
      usersService.findByEmail.mockResolvedValue(buildUser({ passwordHash }));

      await expect(
        authService.login({
          email: 'pravin@example.com',
          password: 'WrongPassword1',
        }),
      ).rejects.toMatchObject({
        code: ErrorCode.INVALID_CREDENTIALS,
      });
    });

    it('accepts the correct password and returns a token', async () => {
      const passwordHash = await bcrypt.hash('Str0ngPass!', 4);
      usersService.findByEmail.mockResolvedValue(buildUser({ passwordHash }));

      const result = await authService.login({
        email: 'pravin@example.com',
        password: 'Str0ngPass!',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
    });
  });
});
