import debug from 'debug';
import * as fs from 'fs';
import * as json5 from 'json5';
import merge = require('merge');
import * as path from 'path';
import { isEmpty, isNotEmpty } from '../tools/CTIUtility';
import { CreateTsIndexOption, getDefailtICreateTsIndexOption } from './CreateTsIndexOption';
import { ICreateTsIndexOption } from './ICreateTsIndexOption';

const log = debug('cti:ctircLoader');
const CTIRC_FILENAME = '.ctirc';

function withoutUndefined(
  value: Partial<ICreateTsIndexOption>,
): Partial<ICreateTsIndexOption> {
  const newValue = { ...value, ...{ globOptions: { ...value.globOptions } } };

  Object.keys(newValue).forEach((key) => {
    if (isEmpty(newValue[key])) {
      delete newValue[key];
    }
  });

  Object.keys(newValue.globOptions).forEach((key) => {
    if (isEmpty(newValue.globOptions[key])) {
      delete newValue.globOptions[key];
    }
  });

  return newValue;
}

export function ctircLoader({
  inputDir,
  cwd,
  fromCliOption,
}: {
  inputDir: string | null;
  cwd: string;
  fromCliOption: Partial<ICreateTsIndexOption>;
}): { readedFrom: string; option: CreateTsIndexOption } {
  log(`inputDir: (${inputDir}) /cwd: (${cwd})`);

  const cleanCliOption = withoutUndefined(fromCliOption);

  // Step01. Read configuration file on parametered input directory
  const targetDirs: Array<string> = (() => {
    const target: Set<string> = new Set<string>();

    if (
      isNotEmpty(inputDir) &&
      fs.existsSync(inputDir) &&
      fs.existsSync(path.join(inputDir, CTIRC_FILENAME))
    ) {
      target.add(inputDir);
    }

    if (fs.existsSync(cwd) && fs.existsSync(path.join(cwd, CTIRC_FILENAME))) {
      target.add(cwd);
    }

    return Array.from(target);
  })();

  log('targetDirs: ', targetDirs);
  // Stop02. Load configuration from .ctirc
  try {
    if (targetDirs.length <= 0) {
      return {
        option: new CreateTsIndexOption(CreateTsIndexOption.getOption(cleanCliOption)),
        readedFrom: 'from cli option',
      };
    }

    const fromConfigfiles = targetDirs.map((targetDir) => {
      const ctircPath = path.join(targetDir, CTIRC_FILENAME);
      const rawConf = fs.readFileSync(ctircPath).toString();
      const fromConfigfile: ICreateTsIndexOption = {
        ...json5.parse(rawConf),
        ...{ globOptions: { cwd: inputDir } },
      };

      return fromConfigfile;
    });

    const mergedCTIRC = fromConfigfiles.reduce((src, dst) => merge.recursive(true, src, dst));

    mergedCTIRC.__for_debug_from = 'from-config-file';

    if (Object.keys(cleanCliOption).length > 0) {
      cleanCliOption.__for_debug_from = 'from-cli-option';
    }

    const option: ICreateTsIndexOption = [
      { __for_debug_from: 'from-default-config', ...getDefailtICreateTsIndexOption() },
      mergedCTIRC,
      cleanCliOption as any,
    ].reduce((src, dst) => merge.recursive(true, src, dst));

    log('final option-1: ', mergedCTIRC);
    log('final option-2: ', cleanCliOption);
    log('final option-3: ', option);

    return { option: CreateTsIndexOption.factory({ option }), readedFrom: 'from config file' };
  } catch (err) {
    log(err.message);
    log(err.stack);

    const option = new CreateTsIndexOption();
    return { option, readedFrom: '' };
  }
}
