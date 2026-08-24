<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## Er Diagram

## ER Diagram

```text
                              ┌──────────────────────┐
                              │         USER         │
                              ├──────────────────────┤
                              │ PK id                │
                              │ name                 │
                              │ email UNIQUE         │
                              │ passwordHash         │
                              │ role                 │
                              │ ADMIN                │
                              │ OWNER                │
                              │ MEMBER               │
                              └──────────┬───────────┘
                                         │
                       ┌─────────────────┼─────────────────┐
                       │                 │                 │
                     1 │               1 │               1 │
                       │                 │                 │
                    0..N│              0..1│               N│
                       ▼                 ▼                 ▼
              ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐
              │      GYM       │  │    MEMBER    │  │   USER_DEVICE   │
              ├────────────────┤  ├──────────────┤  ├─────────────────┤
              │ PK id          │  │ PK id        │  │ PK id           │
              │ FK ownerId     │  │ FK userId    │  │ FK userId       │
              │ name           │  │ phone        │  │ fcmToken UNIQUE │
              │ email          │  │ qrToken      │  └─────────────────┘
              │ phone          │  └───────┬──────┘
              │ address        │          │
              │ city           │          │ 1
              │ state          │          │
              │ zipCode        │          │ N
              └───────┬────────┘          ▼
                      │             ┌────────────────────┐
                      │             │     MEMBERSHIP     │
                      │             ├────────────────────┤
                      │             │ PK id              │
                      │             │ FK memberId        │
                      │             │ FK gymId           │
                      │             │ startDate          │
                      │             │ endDate            │
                      │             │ status             │
                      │             └─────────┬──────────┘
                      │                       │
                      │                       │ 1
                      │                       │
                      │                       │ N
                      │                       ▼
                      │             ┌────────────────────┐
                      │             │     ATTENDANCE     │
                      │             ├────────────────────┤
                      │             │ PK id              │
                      │             │ FK membershipId    │
                      │             │ checkedInAt        │
                      │             │ createdAt          │
                      │             └────────────────────┘
                      │
          ┌───────────┼──────────────────┐
          │           │                  │
          │ 1         │ 1                │ 1
          │           │                  │
          │ N         │ N                │ N
          ▼           ▼                  ▼
 ┌────────────────┐ ┌────────────────┐ ┌─────────────────────────┐
 │ SUBSCRIPTION   │ │ NOTIFICATION   │ │                         │
 ├────────────────┤ ├────────────────┤ │                         │
 │ PK id          │ │ PK id          │ │                         │
 │ FK gymId       │ │ FK gymId       │ │                         │
 │ provider       │ │ title          │ │                         │
 │ status         │ │ message        │ │                         │
 │ startDate      │ │ status         │ │                         │
 │ endDate        │ └───────┬────────┘ │                         │
 └────────────────┘         │          │                         │
                            │ 1        │                         │
                            │          │                         │
                            │ N        │                         │
                            ▼          │                         │
                  ┌─────────────────────────┐                     │
                  │ NOTIFICATION_RECIPIENT  │                     │
                  ├─────────────────────────┤                     │
                  │ PK id                   │                     │
                  │ FK notificationId       │                     │
                  │ FK userId               │                     │
                  │ status                  │                     │
                  │ sentAt                  │                     │
                  │ readAt                  │                     │
                  └───────────┬─────────────┘                     │
                              │                                   │
                              │ N                                 │
                              │                                   │
                              │ 1                                 │
                              ▼                                   │
                             USER ◄───────────────────────────────┘
```

## ER Diagram

```mermaiderDiagram
    USER ||--o{ GYM : owns
    USER ||--o| MEMBER : has
    USER ||--o{ USER_DEVICE : has
    USER ||--o{ NOTIFICATION_RECIPIENT : receives

    GYM ||--o{ MEMBERSHIP : has
    GYM ||--o{ SUBSCRIPTION : has
    GYM ||--o{ NOTIFICATION : creates

    MEMBER ||--o{ MEMBERSHIP : has

    MEMBERSHIP ||--o{ ATTENDANCE : records

    NOTIFICATION ||--o{ NOTIFICATION_RECIPIENT : targets

    USER {
        string id PK
        string name
        string email UK
        string passwordHash
        UserRole role
    }

    GYM {
        string id PK
        string ownerId FK
        string name
        string email
        string phone
        string address
        string city
        string state
        string zipCode
    }

    MEMBER {
        string id PK
        string userId FK
        string phone
        string qrToken UK
    }

    MEMBERSHIP {
        string id PK
        string memberId FK
        string gymId FK
        datetime startDate
        datetime endDate
        MembershipStatus status
    }

    ATTENDANCE {
        string id PK
        string membershipId FK
        datetime checkedInAt
        datetime createdAt
    }

    SUBSCRIPTION {
        string id PK
        string gymId FK
        string provider
        SubscriptionStatus status
        datetime startDate
        datetime endDate
    }

    NOTIFICATION {
        string id PK
        string gymId FK
        string title
        string message
        NotificationStatus status
    }

    NOTIFICATION_RECIPIENT {
        string id PK
        string notificationId FK
        string userId FK
        NotificationDeliveryStatus status
        datetime sentAt
        datetime readAt
    }

    USER_DEVICE {
        string id PK
        string userId FK
        string fcmToken UK
    }
```
