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

const startMysql = async ({util, answers, username, docker}) => {
  const deploymentName = util.nameFromImage(mysqlImage);
  return docker.startFromParams({
    image: mysqlImage,
    projectName: answers.projectName,
    username,
    deploymentName,
    hostname: deploymentName,
    restartPolicy: 'always',
    Env: [`MYSQL_ROOT_PASSWORD=${answers.mysqlPassword}`],
  });
};

const startWordpress = async ({util, answers, serverConfig, username, docker, mysql}) => {
  const deploymentName = util.nameFromImage(wordpressImage);

  const mysqlHost = serverConfig.swarm
    ? mysql.Spec.Networks[0].Aliases
    : mysql.NetworkSettings.Networks.exoframe.Aliases[0];

  return docker.startFromParams({
    image: wordpressImage,
    projectName: answers.projectName,
    username,
    deploymentName,
    frontend: `Host:${answers.wordpressDomain}`,
    restartPolicy: 'always',
    Env: [`WORDPRESS_DB_HOST=${mysqlHost}`, `WORDPRESS_DB_PASSWORD=${answers.mysqlPassword}`],
  });
};

const startPhpmyadmin = async ({util, answers, serverConfig, username, docker, mysql}) => {
  const deploymentName = util.nameFromImage(phpmyadminImage);

  const mysqlHost = serverConfig.swarm
    ? mysql.Spec.Networks[0].Aliases
    : mysql.NetworkSettings.Networks.exoframe.Aliases[0];

  return docker.startFromParams({
    image: phpmyadminImage,
    projectName: answers.projectName,
    username,
    deploymentName,
    frontend: `Host:${answers.phpmyadminDomain}`,
    restartPolicy: 'always',
    Env: [`PMA_HOST=${mysqlHost}`, `MYSQL_ROOT_PASSWORD=${answers.mysqlPassword}`],
  });
};

exports.runSetup = async ({answers, serverConfig, username, docker, util}) => {
  // init log
  const log = [];

  try {
    util.logger.debug('starting work..');
    // start mysql container
    util.logger.debug('starting mysql..');
    const mysql = await startMysql({util, answers, username, docker});
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
