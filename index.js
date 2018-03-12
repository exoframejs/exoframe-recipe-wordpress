const mysqlImage = 'mariadb:latest';
const wordpressImage = 'wordpress:latest';
const phpmyadminImage = 'phpmyadmin/phpmyadmin:latest';

exports.getQuestions = () => [
  {
    type: 'input',
    name: 'projectName',
    message: 'Wordpress project name:',
  },
  {
    type: 'input',
    name: 'mysqlPassword',
    message: 'MySQL root password:',
  },
  {
    type: 'input',
    name: 'wordpressDomain',
    message: 'Domain for Wordpress:',
  },
  {
    type: 'confirm',
    name: 'phpmyadminStart',
    message: 'Also start PHPMyAdmin?',
  },
  {
    type: 'input',
    name: 'phpmyadminDomain',
    message: 'Domain for PHPMyAdmin:',
  },
];

const startMysql = async ({util, answers, serverConfig, username, docker}) => {
  // create and start mysql db
  const name = util.nameFromImage(mysqlImage);
  // env
  const Env = [`MYSQL_ROOT_PASSWORD=${answers.mysqlPassword}`];
  // restart policy
  const RestartPolicy = {
    Name: 'always',
  };
  // labels
  const Labels = {
    'exoframe.deployment': name,
    'exoframe.user': username,
    'exoframe.project': answers.projectName,
    'traefik.backend': name,
  };

  // if running in swarm mode - run as swarm service
  if (serverConfig.swarm) {
    // create service config
    const serviceConfig = {
      Name: name,
      Labels,
      TaskTemplate: {
        ContainerSpec: {
          Image: mysqlImage,
          Env,
        },
        Resources: {
          Limits: {},
          Reservations: {},
        },
        RestartPolicy,
        Placement: {},
      },
      Mode: {
        Replicated: {
          Replicas: 1,
        },
      },
      UpdateConfig: {
        Parallelism: 2, // allow 2 instances to run at the same time
        Delay: 10000000000, // 10s
        Order: 'start-first', // start new instance first, then remove old one
      },
      Networks: [
        {
          Target: serverConfig.exoframeNetworkSwarm,
          Aliases: [name],
        },
      ],
    };

    // create service
    const service = await docker.daemon.createService(serviceConfig);

    return service.inspect();
  }

  // create config
  const containerConfig = {
    Image: mysqlImage,
    name,
    Env,
    Labels,
    HostConfig: {
      RestartPolicy,
    },
    NetworkingConfig: {
      EndpointsConfig: {
        exoframe: {
          Aliases: [name],
        },
      },
    },
  };

  // create container
  const container = await docker.daemon.createContainer(containerConfig);

  // connect container to exoframe network
  const exoNet = await docker.getNetwork();
  await exoNet.connect({
    Container: container.id,
  });

  // start container
  await container.start();
  const containerInfo = await container.inspect();
  const containerData = docker.daemon.getContainer(containerInfo.Id);
  return containerData.inspect();
};

const startWordpress = async ({util, answers, serverConfig, username, docker, mysql}) => {
  // create and start wordpress
  const name = util.nameFromImage(wordpressImage);
  // env
  const mysqlHost = serverConfig.swarm
    ? mysql.Spec.Networks[0].Aliases
    : mysql.NetworkSettings.Networks.exoframe.Aliases[0];
  const Env = [`WORDPRESS_DB_HOST=${mysqlHost}`, `WORDPRESS_DB_PASSWORD=${answers.mysqlPassword}`];
  // restart policy
  const RestartPolicy = {
    Name: 'always',
  };
  // labels
  const baseLabels = serverConfig.swarm ? {'traefik.port': '80'} : {};
  const Labels = Object.assign(baseLabels, {
    'exoframe.deployment': name,
    'exoframe.user': username,
    'exoframe.project': answers.projectName,
    'traefik.backend': name,
    'traefik.frontend.rule': `Host:${answers.wordpressDomain}`,
  });

  // if running in swarm mode - run as swarm service
  if (serverConfig.swarm) {
    // create service config
    const serviceConfig = {
      Name: name,
      Labels,
      TaskTemplate: {
        ContainerSpec: {
          Image: wordpressImage,
          Env,
        },
        Resources: {
          Limits: {},
          Reservations: {},
        },
        RestartPolicy,
        Placement: {},
      },
      Mode: {
        Replicated: {
          Replicas: 1,
        },
      },
      UpdateConfig: {
        Parallelism: 2, // allow 2 instances to run at the same time
        Delay: 10000000000, // 10s
        Order: 'start-first', // start new instance first, then remove old one
      },
      Networks: [
        {
          Target: serverConfig.exoframeNetworkSwarm,
          Aliases: [],
        },
      ],
    };

    // create service
    const service = await docker.daemon.createService(serviceConfig);

    return service.inspect();
  }

  // create config
  const containerConfig = {
    Image: wordpressImage,
    name,
    Env,
    Labels,
    HostConfig: {
      RestartPolicy,
    },
  };

  // create container
  const container = await docker.daemon.createContainer(containerConfig);

  // connect container to exoframe network
  const exoNet = await docker.getNetwork();
  await exoNet.connect({
    Container: container.id,
  });

  // start container
  await container.start();
  const containerInfo = await container.inspect();
  const containerData = docker.daemon.getContainer(containerInfo.Id);
  return containerData.inspect();
};

const startPhpmyadmin = async ({util, answers, serverConfig, username, docker, mysql}) => {
  // create and start phpmyadmin
  const name = util.nameFromImage(phpmyadminImage);
  // env
  const mysqlHost = serverConfig.swarm
    ? mysql.Spec.Networks[0].Aliases
    : mysql.NetworkSettings.Networks.exoframe.Aliases[0];
  const Env = [`PMA_HOST=${mysqlHost}`, `MYSQL_ROOT_PASSWORD=${answers.mysqlPassword}`];
  // restart policy
  const RestartPolicy = {
    Name: 'always',
  };
  // labels
  const baseLabels = serverConfig.swarm ? {'traefik.port': '80'} : {};
  const Labels = Object.assign(baseLabels, {
    'exoframe.deployment': name,
    'exoframe.user': username,
    'exoframe.project': answers.projectName,
    'traefik.backend': name,
    'traefik.frontend.rule': `Host:${answers.phpmyadminDomain}`,
  });

  // if running in swarm mode - run as swarm service
  if (serverConfig.swarm) {
    // create service config
    const serviceConfig = {
      Name: name,
      Labels,
      TaskTemplate: {
        ContainerSpec: {
          Image: phpmyadminImage,
          Env,
        },
        Resources: {
          Limits: {},
          Reservations: {},
        },
        RestartPolicy,
        Placement: {},
      },
      Mode: {
        Replicated: {
          Replicas: 1,
        },
      },
      UpdateConfig: {
        Parallelism: 2, // allow 2 instances to run at the same time
        Delay: 10000000000, // 10s
        Order: 'start-first', // start new instance first, then remove old one
      },
      Networks: [
        {
          Target: serverConfig.exoframeNetworkSwarm,
          Aliases: [],
        },
      ],
    };

    // create service
    const service = await docker.daemon.createService(serviceConfig);

    return service.inspect();
  }

  // create config
  const containerConfig = {
    Image: phpmyadminImage,
    name,
    Env,
    Labels,
    HostConfig: {
      RestartPolicy,
    },
  };

  // create container
  const container = await docker.daemon.createContainer(containerConfig);

  // connect container to exoframe network
  const exoNet = await docker.getNetwork();
  await exoNet.connect({
    Container: container.id,
  });

  // start container
  await container.start();
  const containerInfo = await container.inspect();
  const containerData = docker.daemon.getContainer(containerInfo.Id);
  return containerData.inspect();
};

exports.runSetup = async ({answers, serverConfig, username, docker, util}) => {
  // init log
  const log = [];

  try {
    util.logger.debug('starting work..');
    // start mysql container
    util.logger.debug('starting mysql..');
    const mysql = await startMysql({util, answers, serverConfig, username, docker});
    log.push({message: 'Mysql container started', data: mysql, level: 'info'});
    util.logger.debug('created mysql container..');

    // start wordpress container
    util.logger.debug('starting wordpress..');
    const wordpress = await startWordpress({util, answers, serverConfig, username, docker, mysql});
    log.push({message: 'Wordpress container started', data: wordpress, level: 'info'});
    util.logger.debug('created wordpress container..');

    // start phpmyadmin if needed
    if (answers.phpmyadminStart) {
      util.logger.debug('starting phpmyadmin..');
      const phpmyadmin = await startPhpmyadmin({util, answers, serverConfig, username, docker, mysql});
      log.push({message: 'PHPMyAdmin container started', data: phpmyadmin, level: 'info'});
      util.logger.debug('created phpmyadmin container..');
    }
  } catch (e) {
    util.logger.error('error:', e);
    log.push({message: e.toString(), data: e, level: 'error'});
  }

  return log;
};
