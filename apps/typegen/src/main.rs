use clap::{self, arg, value_parser, Arg, Command};
use ignore::overrides::OverrideBuilder;
use ignore::types::TypesBuilder;
use ignore::WalkBuilder;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, path::Path};
use typeshare_core::language::{Language, TypeScript};

#[derive(Default, Serialize, Deserialize, PartialEq, Eq, Debug)]
#[serde(default)]
pub struct TypeScriptParams {
    pub type_mappings: HashMap<String, String>,
}

fn build_args() -> Command {
    Command::new("typegen")
        .arg(
            Arg::new("directories")
                .short('d')
                .value_parser(value_parser!(String))
                .help("Directories within which to recursively find and process rust files"),
        )
        .arg(arg!(-o --output <OUTPUT_PATH> "the output path of the generated types"))
}

fn main() {
    let options = build_args().get_matches();

    let mut directories = options
        .get_many::<String>("directories")
        .unwrap_or_else(|| {
            eprintln!("Error: No directories specified");
            std::process::exit(1);
        });

    let outfile = Path::new(options.get_one::<String>("output").unwrap());

    let mut lang: Box<dyn Language> = Box::new(TypeScript {
        type_mappings: TypeScriptParams::default().type_mappings,
        ..Default::default()
    });

    let mut types = TypesBuilder::new();
    types.add("rust", "*.rs").unwrap();
    types.select("rust");

    // This is guaranteed to always have at least one value by the clap configuration
    let first_root = directories.next().unwrap();

    println!("{}", first_root);

    let overrides = OverrideBuilder::new(first_root)
        // Don't process files inside of tools/typeshare/
        .add("!**/tools/typeshare/**")
        .expect("Failed to parse override")
        .build()
        .expect("Failed to build override");

    let mut walker_builder = WalkBuilder::new(first_root);
    // Sort walker output for deterministic output across platforms
    walker_builder.sort_by_file_path(|a, b| a.cmp(b));
    walker_builder.types(types.build().expect("Failed to build types"));
    walker_builder.overrides(overrides);

    for root in directories {
        walker_builder.add(root);
    }

    // The walker ignores directories that are git-ignored. If you need
    // a git-ignored directory to be processed, add the specific directory to
    // the list of directories given to typeshare when it's invoked in the
    // makefiles
    let glob_paths = walker_builder
        .build()
        .filter_map(Result::ok)
        .filter(|dir_entry| !dir_entry.path().is_dir())
        .filter_map(|dir_entry| dir_entry.path().to_str().map(String::from));

    let mut generated_contents = vec![];
    let parsed_data = glob_paths
        .map(|filepath| {
            let data = std::fs::read_to_string(&filepath).unwrap_or_else(|e| {
                eprintln!("Failed to read file at {:?}: {}", filepath, e);
                std::process::exit(1);
            });
            match typeshare_core::parser::parse(&data) {
                Ok(parsed_data) => parsed_data,
                Err(e) => {
                    eprintln!("Failed to parse file at {:?}: {}", filepath, e);
                    std::process::exit(1);
                }
            }
        })
        .reduce(|mut identity, other| {
            identity.add(other);
            identity
        });

    if let Some(dat) = parsed_data {
        lang.generate_types(&mut generated_contents, &dat)
            .expect("Couldn't generate types");
    }

    match fs::read(outfile) {
        Ok(buf) if buf == generated_contents => {
            // ok! don't need to do anything :)
            // avoid writing the file to leave the mtime intact
            // for tools which might use it to know when to
            // rebuild.
            return;
        }
        _ => {}
    }

    let out_dir = outfile.parent().unwrap();
    // If the output directory doesn't already exist, create it.
    if !out_dir.exists() {
        fs::create_dir_all(out_dir).expect("failed to create output directory");
    }

    fs::write(outfile, generated_contents).expect("failed to write output");
}
