#!/usr/bin/env ruby
MRUBY_GIT = "https://github.com/mruby/mruby.git"
MRUBY_VERSION = ENV["MRUBY_VERSION"]
abort "MRUBY_VERSION required" unless MRUBY_VERSION
MRUBY_PLATFORM = ENV["MRUBY_PLATFORM"]
abort "MRUBY_PLATFORM required" unless MRUBY_PLATFORM
MRUBY_ARCH = ENV["MRUBY_ARCH"]
abort "MRUBY_ARCH required" unless MRUBY_ARCH
EXEEXT = RbConfig::CONFIG["EXEEXT"]

require("fileutils")

puts "-------- Starting --------"
puts "version: #{MRUBY_VERSION}"
puts "arch: #{MRUBY_ARCH}"
STDOUT.flush

FileUtils.makedirs(MRUBY_VERSION)
tar_path = "#{MRUBY_VERSION}/#{MRUBY_PLATFORM}-#{MRUBY_ARCH}.tar"
if File.exists?("#{tar_path}.lzma")
  puts "skipped (already exists)"
  exit(0)
end

unless Dir.exists?("mruby")
  puts "-------- Cloning repository --------"
  STDOUT.flush
  abort "git clone failed" unless system(*%W[git clone #{MRUBY_GIT} --no-checkout mruby])
end
Dir.chdir("mruby") do
  puts "-------- Checking out repository --------"
  STDOUT.flush
  abort "git checkout failed" unless system(*%W[git checkout #{MRUBY_VERSION}])
  puts "-------- Building mruby --------"
  STDOUT.flush
  abort "build failed" unless system(*%W[ruby ./minirake])
end
Dir.chdir(FileUtils.makedirs("mruby/build/#{MRUBY_PLATFORM}/#{MRUBY_ARCH}")[0]) do
  puts "-------- Collecting artifacts --------"
  STDOUT.flush
  {"host" => %w[mirb mrbc mruby], "host-debug" => %w[mrdb]}.each_pair do |dir, names|
    names.each do |name|
      FileUtils.copy("../../#{dir}/bin/#{name}#{EXEEXT}", "./")
      if MRUBY_PLATFORM != "win32"
        abort "strip failed" unless system(*%W[strip #{name}#{EXEEXT}])
      end
    end
  end
end

puts "-------- Making archive --------"
STDOUT.flush
abort "tar failed" unless system(*%W[tar cf #{tar_path} -C mruby/build #{MRUBY_PLATFORM}])
STDOUT.flush
abort "lzma failed" unless system(*%W[lzma -9 #{tar_path}])
