type IndexTypes = typeof import('../native');
type IndexKeys = keyof IndexTypes;

export const enum DummyType {
    Getter,
    Function,
}

type OmitPrototype<
    Key extends IndexKeys,
    IsClass extends boolean,
> = IsClass extends true ? Omit<IndexTypes[Key], 'prototype'> : IndexTypes[Key];

type AnyFunction = (...args: any[]) => any;
type Constructor = new (...args: any[]) => any;

type OverrideFunction<T> = T extends AnyFunction
    ? (...args: Parameters<T>) => ReturnType<T>
    : () => T;

type DummyRecord<Key extends IndexKeys, IsClass extends boolean> = {
    [key in keyof OmitPrototype<Key, IsClass>]: OmitPrototype<
        Key,
        IsClass
    >[key] extends AnyFunction
        ? DummyType.Function
        : DummyType.Getter;
};

type DummyOverride<Key extends IndexKeys, IsClass extends boolean> = {
    [key in keyof OmitPrototype<Key, IsClass>]?: OverrideFunction<
        OmitPrototype<Key, IsClass>[key]
    >;
};

type DummyIsClass<Key extends IndexKeys> = IndexTypes[Key] extends Constructor
    ? {
          isClass: true;
      }
    : {
          isClass?: false;
      };

interface DummyOpts<Key extends IndexKeys, IsClass extends boolean> {
    key: Key;
    dummies: DummyRecord<Key, IsClass>;
    overrides?: DummyOverride<Key, IsClass>;
}

type DummyOptsKeys<
    Key extends IndexKeys,
    IsClass extends boolean,
> = keyof DummyOpts<Key, IsClass>['dummies'];

type DummyOptions<Key extends IndexKeys, IsClass extends boolean> = DummyOpts<
    Key,
    IsClass
> &
    DummyIsClass<Key>;

function createDummy<Key extends IndexKeys, IsClass extends boolean>(
    opts: DummyOptions<Key, IsClass>
): Readonly<IndexTypes[Key]> {
    try {
        return require('../native')[opts.key];
    } catch (e) {
        const obj = opts.isClass
            ? class {
                  constructor() {
                      throw e;
                  }
              }
            : {};

        return Object.freeze(
            Object.defineProperties(
                obj as IndexTypes[Key],
                (
                    Object.keys(opts.dummies) as DummyOptsKeys<Key, IsClass>[]
                ).reduce((prev, cur) => {
                    const key =
                        opts.dummies[cur] === DummyType.Getter
                            ? 'get'
                            : 'value';

                    return {
                        ...prev,
                        [cur]: {
                            [key]: (
                                // @ts-expect-error
                                ...args: Parameters<IndexTypes[Key][typeof cur]>
                            ) => {
                                if (opts.overrides && opts.overrides[cur]) {
                                    // @ts-expect-error
                                    return opts.overrides[cur]!(...args);
                                } else {
                                    throw e;
                                }
                            },
                            enumerable: true,
                        },
                    };
                }, {})
            )
        );
    }
}

type DummiesOption<Key extends IndexKeys> = Omit<
    DummyOptions<Key, IndexTypes[Key] extends Constructor ? true : false>,
    'key'
>;

type DummiesOptions = {
    [key in IndexKeys]: DummiesOption<key>;
};

export function createDummies(obj: DummiesOptions): Readonly<IndexTypes> {
    return Object.freeze(
        (Object.keys(obj) as IndexKeys[]).reduce(
            (prev, cur) => ({
                ...prev,
                [cur]: createDummy({
                    key: cur,
                    ...(obj[cur] as DummiesOption<typeof cur>),
                }),
            }),
            {}
        )
    ) as IndexTypes;
}
